#!/usr/bin/env python3
"""Submit evidence-backed data-finder candidates in safe, retryable batches."""
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

REPORT = Path("event-data-proposals.json")
ENDPOINT = "https://oycfmdovrnvhcwxmpanl.supabase.co/functions/v1/ingest-event-date-proposals"
BATCH_SIZE = 50
RETRIES = 4
TRANSIENT_STATUS = {408, 425, 429, 500, 502, 503, 504}


def unique_proposals(proposals):
    """Deduplicate candidates before sending; keep the newest occurrence."""
    unique = {}
    for proposal in proposals:
        payload = proposal.get("payload") or {}
        key = (
            proposal.get("proposal_type"),
            payload.get("eventId"),
            payload.get("routeId"),
            payload.get("field"),
            payload.get("sourceUrl"),
        )
        unique[key] = proposal
    return list(unique.values())


def get_github_oidc_token():
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    token = os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    request = urllib.request.Request(
        url + "&audience=trail-event-proposals",
        headers={"Authorization": "Bearer " + token},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)["value"]


def post_batch(batch, jwt, batch_number):
    body = json.dumps({"proposals": batch}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Authorization": "Bearer " + jwt,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    for attempt in range(RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = json.load(response)
            print(json.dumps({
                "batch": batch_number,
                "batchCandidates": len(batch),
                "inserted": result.get("inserted", 0),
                "duplicates": result.get("duplicates", 0),
            }, ensure_ascii=False))
            return result
        except urllib.error.HTTPError as error:
            if error.code not in TRANSIENT_STATUS or attempt == RETRIES:
                detail = error.read().decode("utf-8", "replace")[:1000]
                raise SystemExit(
                    f"Proposal batch {batch_number} failed with HTTP {error.code}: {detail}"
                ) from error
        except (TimeoutError, urllib.error.URLError) as error:
            if attempt == RETRIES:
                raise SystemExit(
                    f"Proposal batch {batch_number} timed out after {RETRIES + 1} attempts: {error}"
                ) from error
        time.sleep(min(2 ** attempt, 20))
    raise SystemExit(f"Proposal batch {batch_number} failed without a response.")


def main():
    if not REPORT.exists():
        raise SystemExit("event-data-proposals.json missing")
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    proposals = report.get("proposals", [])
    if not proposals:
        print("No evidence-backed candidates found.")
        return

    proposals = unique_proposals(proposals)
    jwt = get_github_oidc_token()
    totals = {
        "submittedCandidates": len(proposals),
        "inserted": 0,
        "duplicates": 0,
        "batches": 0,
    }
    for start in range(0, len(proposals), BATCH_SIZE):
        batch = proposals[start : start + BATCH_SIZE]
        result = post_batch(batch, jwt, totals["batches"] + 1)
        totals["inserted"] += int(result.get("inserted", 0))
        totals["duplicates"] += int(result.get("duplicates", 0))
        totals["batches"] += 1

    print(json.dumps(totals, ensure_ascii=False))


if __name__ == "__main__":
    main()
