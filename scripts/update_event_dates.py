import json, re, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

# Official 2027 dates checked against organizer/regional event listings.
# Route indexes refer to the order in EVENTS in index.html.
CURATED_2027 = {
    "1": {"source": "https://marathondessables.com/en/events", "routes": {"0": "2027-01-08", "1": "2027-01-08"}},
    "5": {"source": "https://transgrancanaria.net/en/regulations/", "routes": {"0": "2027-02-26", "1": "2027-02-27"}},
    "49": {"source": "https://zugspitz.utmb.world/races", "routes": {"0": "2027-06-19", "1": "2027-06-19", "2": "2027-06-18", "3": "2027-06-18", "4": "2027-06-17"}},
    "51": {"source": "https://www.tirol.at/aktivitaeten/events/trailrun-events", "routes": {"0": "2027-06-12"}},
    "12": {"source": "https://istria.utmb.world/", "routes": {"0": "2027-04-03", "1": "2027-04-03"}},
    "43": {"source": "https://mozart.utmb.world/races/mozart100", "routes": {"0": "2027-06-05", "1": "2027-06-05", "2": "2027-06-05", "3": "2027-06-05"}},
}

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
match = re.search(r"const EVENTS=(\[.*?\]);\s*(?:const|let|function)", HTML, re.S)
if not match:
    raise SystemExit("EVENTS array not found")
events = json.loads(match.group(1))
out = {"updatedAt": datetime.now(timezone.utc).isoformat(), "events": {}}

def walk(obj):
    if isinstance(obj, dict):
        typ = obj.get("@type", [])
        if isinstance(typ, str): typ = [typ]
        if any(str(t).lower() == "event" for t in typ) and obj.get("startDate"):
            yield obj
        for value in obj.values():
            yield from walk(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from walk(value)

for event_id, event in enumerate(events):
    urls = []
    for route in event.get("routes", []):
        url = route.get("web")
        if isinstance(url, str) and url.startswith(("https://", "http://")) and url not in urls:
            urls.append(url)
    if not urls:
        continue
    entry = {"checkedAt": datetime.now(timezone.utc).isoformat(), "source": urls[0], "status": "unconfirmed", "routes": {}}
    try:
        req = urllib.request.Request(urls[0], headers={"User-Agent": "Mozilla/5.0 (compatible; TrailEventPlanner/1.0)"})
        with urllib.request.urlopen(req, timeout=18) as response:
            page = response.read(3_000_000).decode("utf-8", "replace")
        blocks = re.findall(r"<script[^>]+type=['\"]application/ld[+]json['\"][^>]*>(.*?)</script>", page, re.I | re.S)
        found = []
        for block in blocks:
            try: found.extend(walk(json.loads(block.strip())))
            except Exception: pass
        usable = []
        for item in found:
            date = str(item.get("startDate", ""))[:10]
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                usable.append((str(item.get("name", "")), date))
        for route_index, route in enumerate(event.get("routes", [])):
            route_name = str(route.get("route") or route.get("name") or "").strip().lower()
            event_name = str(event.get("name", "")).strip().lower()
            exact = [d for name, d in usable if name.strip().lower() == route_name and route_name]
            if not exact:
                exact = [d for name, d in usable if name.strip().lower() == event_name and event_name]
            # For the two Munich 100 km series entries, match the official city/distance
            # event title rather than assigning dates from other cities in the series.
            if not exact and event.get("name") in ("Mammutmarsch", "Megamarsch") and "100" in route_name and "münchen" in route_name:
                prefix = event.get("name", "").lower()
                exact = [d for name, d in usable
                         if prefix in name.lower() and "münchen" in name.lower()
                         and ("100" in name or "75/100" in name)]
            if len(set(exact)) == 1:
                entry["routes"][str(route_index)] = {"date": exact[0], "verified": True}
        if entry["routes"]:
            entry["status"] = "verified"
        elif usable:
            entry["status"] = "date-not-matched"
    except Exception as exc:
        entry["status"] = "unavailable"
        entry["error"] = str(exc)[:180]
    out["events"][str(event_id)] = entry

# Preserve manually verified official dates even when an event page has no machine-readable JSON-LD.
for event_id, curated in CURATED_2027.items():
    entry = out["events"].setdefault(event_id, {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "source": curated["source"], "status": "verified", "routes": {}
    })
    entry["source"] = curated["source"]
    entry["status"] = "verified"
    entry.setdefault("routes", {})
    for route_index, date in curated["routes"].items():
        entry["routes"][route_index] = {"date": date, "verified": True}

(ROOT / "event-dates.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Processed {len(out['events'])} events with official URLs")
