#!/usr/bin/env python3
"""Submit evidence-backed data-finder candidates to the existing owner-review ingestion endpoint."""
import json, os, urllib.request
from pathlib import Path
p=Path("event-data-proposals.json")
if not p.exists(): raise SystemExit("event-data-proposals.json missing")
report=json.loads(p.read_text(encoding="utf-8"))
proposals=report.get("proposals",[])
if not proposals:
    print("No evidence-backed candidates found.")
    raise SystemExit(0)
url=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
token=os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
req=urllib.request.Request(url+"&audience=trail-event-proposals",headers={"Authorization":"Bearer "+token})
with urllib.request.urlopen(req,timeout=20) as response: jwt=json.load(response)["value"]
body=json.dumps({"proposals":proposals}).encode()
request=urllib.request.Request("https://oycfmdovrnvhcwxmpanl.supabase.co/functions/v1/ingest-event-date-proposals",data=body,
 headers={"Authorization":"Bearer "+jwt,"Content-Type":"application/json"},method="POST")
with urllib.request.urlopen(request,timeout=30) as response: result=json.load(response)
print(json.dumps({"submittedCandidates":len(proposals),"result":result},ensure_ascii=False))
