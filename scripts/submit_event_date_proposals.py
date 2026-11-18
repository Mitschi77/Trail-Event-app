#!/usr/bin/env python3
"""Turn verified event-date feed changes into review proposals; never publish them."""
import json
import os
import subprocess
import urllib.request

def load_old():
    raw = subprocess.check_output(["git", "show", "HEAD:event-dates.json"], text=True)
    return json.loads(raw)

def load_new():
    with open("event-dates.json", encoding="utf-8") as f:
        return json.load(f)

old, new = load_old(), load_new()
old_events, new_events = old.get("events", {}), new.get("events", {})
proposals = []

for event_id, current in new_events.items():
    previous = old_events.get(event_id, {})
    if current.get("status") != "verified":
        continue
    sources = [s for s in current.get("sources", []) if s.get("url")]
    verified_sources = [s["url"] for s in sources if s.get("status") == "read"]
    if not verified_sources:
        continue

    old_period, new_period = previous.get("eventPeriod") or {}, current.get("eventPeriod") or {}
    for field in ("startDate", "endDate"):
        before, after = old_period.get(field), new_period.get(field)
        if after and new_period.get("verified") is True and before != after:
            proposals.append({
                "proposal_type": "event_change",
                "title": f"Eventdatum prüfen: {event_id} · {field}",
                "payload": {
                    "source": "official_event_date_feed", "eventId": event_id,
                    "field": field, "oldValue": before, "newValue": after,
                    "checkedAt": current.get("checkedAt"), "sources": verified_sources
                }
            })

    old_routes, new_routes = previous.get("routes", {}), current.get("routes", {})
    for index, route in new_routes.items():
        before_route = old_routes.get(index, {})
        after, before = route.get("date"), before_route.get("date")
        if after and route.get("verified") is True and not route.get("fallback") and before != after:
            proposals.append({
                "proposal_type": "route_change",
                "title": f"Streckendatum prüfen: {event_id} · {route.get('routeId') or index}",
                "payload": {
                    "source": "official_event_date_feed", "eventId": event_id,
                    "routeId": route.get("routeId"), "routeIndex": index,
                    "field": "date", "oldValue": before, "newValue": after,
                    "checkedAt": current.get("checkedAt"), "sources": verified_sources
                }
            })

if not proposals:
    print("Keine verifizierten Datumsänderungen gegenüber dem veröffentlichten Feed.")
    raise SystemExit(0)

oidc_url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
oidc_token = os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
oidc_req = urllib.request.Request(
    oidc_url + "&audience=trail-event-proposals",
    headers={"Authorization": "Bearer " + oidc_token}
)
with urllib.request.urlopen(oidc_req) as response:
    token = json.load(response)["value"]

data = json.dumps({"proposals": proposals}).encode()
req = urllib.request.Request(
    "https://oycfmdovrnvhcwxmpanl.supabase.co/functions/v1/ingest-event-date-proposals",
    data=data,
    headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(req) as response:
    result = json.load(response)
print(json.dumps({"detected": len(proposals), **result}, ensure_ascii=False))
