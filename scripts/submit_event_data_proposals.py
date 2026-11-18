#!/usr/bin/env python3
"""Submit evidence-backed candidates in small, retryable batches to owner review."""
import json, os, time, urllib.request, urllib.error
from pathlib import Path

report_path=Path("event-data-proposals.json")
if not report_path.exists():
    raise SystemExit("event-data-proposals.json missing")
report=json.loads(report_path.read_text(encoding="utf-8"))
proposals=report.get("proposals", [])
if not proposals:
    print("No evidence-backed candidates found.")
    raise SystemExit(0)

oidc_url=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
oidc_token=os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
oidc_req=urllib.request.Request(oidc_url+"&audience=trail-event-proposals",
    headers={"Authorization":"Bearer "+oidc_token})
with urllib.request.urlopen(oidc_req, timeout=30) as response:
    jwt=json.load(response)["value"]

endpoint="https://oycfmdovrnvhcwxmpanl.supabase.co/functions/v1/ingest-event-date-proposals"
submitted=0
for start in range(0, len(proposals), 8):
    batch=proposals[start:start+8]
    body=json.dumps({"proposals":batch}).encode()
    request=urllib.request.Request(endpoint, data=body,
        headers={"Authorization":"Bearer "+jwt,"Content-Type":"application/json"},
        method="POST")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result=json.load(response)
            print(json.dumps({"batch":start//8+1,"candidates":len(batch),"result":result},ensure_ascii=False))
            submitted += len(batch)
            break
        except (TimeoutError, urllib.error.URLError) as exc:
            if attempt == 3:
                raise
            print(f"Batch {start//8+1} timed out/temporarily failed; retry {attempt+1}: {exc}", flush=True)
            time.sleep(2 ** (attempt+1))
print(json.dumps({"submittedCandidates":submitted,"totalCandidates":len(proposals)},ensure_ascii=False))
