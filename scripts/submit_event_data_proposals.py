#!/usr/bin/env python3
"""Submit evidence-backed data-finder candidates to the owner-review queue in safe batches."""
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

if not REPORT.exists():
    raise SystemExit("event-data-proposals.json missing")

report = json.loads(REPORT.read_text(encoding="utf-8"))
proposals = report.get("proposals", [])
if not proposals:
    print("No evidence-backed candidates found.")
    raise SystemExit(0)

unique = {}
for proposal in proposals:
    payload = proposal.get("payload") or {}
    key = (payload.get("eventId"), payload.get("routeId"), payload.get("field"), payload.get("sourceUrl"))
    unique[key] = proposal
proposals = list(unique.values())

token_url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
token_request_token = os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
token_request = urllib.request.Request(
    token_url + "&audience=trail-event-proposals",
    headers={"Authorization": "Bearer " + token_request_token},
)
with urllib.request.urlopen(token_request, timeout=20) as response:
    jwt = json.load(response)["value"]

totals = {"submittedCandidates": len(proposals), "inserted": 0, "duplicates": 0, "batches": 0}
for start in range(0, len(proposals), BATCH_SIZE):
    batch = proposals[start : start + BATCH_SIZE]
    body = json.dumps({"proposals": batch}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Authorization": "Bearer " + jwt, "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = json.load(response)
            totals["inserted"] += int(result.get("inserted", 0))
            totals["duplicates"] += int(result.get("duplicates", 0))
            totals["batches"] += 1
            print(json.dumps({
                "batch": totals["batches"],
                "batchCandidates": len(batch),
                "inserted": result.get("inserted", 0),
                "duplicates": result.get("duplicates", 0),
            }, ensure_ascii=False))
            break
        except urllib.error.HTTPError as error:
            if error.code not in TRANSIENT_STATUS or attempt == RETRIES:
                detail = error.read().decode("utf-8", "replace")[:1000]
                raise SystemExit(f"Proposal batch failed with HTTP {error.code}: {detail}") from error
            time.sleep(min(2 ** attempt, 20))
        except (TimeoutError, urllib.error.URLError) as error:
            if attempt == RETRIES:
                raise SystemExit(f"Proposal batch timed out after {RETRIES + 1} attempts: {error}") from error
            time.sleep(min(2 ** attempt, 20))

print(json.dumps(totals, ensure_ascii=False))
