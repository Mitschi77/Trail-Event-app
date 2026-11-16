import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
match = re.search(r"const EVENTS=(\[.*?\]);\s*let userAddedEvents", HTML, re.S)
if not match:
    raise SystemExit("EVENTS array not found")
events = json.loads(match.group(1))

def slug(value):
    value = str(value or "item").replace("ß", "ss")
    value = "".join(ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "item"

errors = []
event_ids = set()
route_total = 0
filled = {"km": 0, "hm": 0, "maxh": 0, "date": 0, "profileUrl": 0, "cutoffUrl": 0}

for event_index, event in enumerate(events):
    name = str(event.get("name") or "").strip()
    if not name:
        errors.append(f"Event {event_index}: missing name")
    event_id = slug(name)
    if event_id in event_ids:
        errors.append(f"Event {event_index}: duplicate stable ID {event_id}")
    event_ids.add(event_id)
    routes = event.get("routes")
    if not isinstance(routes, list) or not routes:
        errors.append(f"{name}: no routes")
        continue
    route_ids = set()
    for route_index, route in enumerate(routes):
        route_total += 1
        base = slug("-".join([
            str(route.get("route") or route.get("name") or "strecke"),
            str(route.get("km") if route.get("km") is not None else ""),
            str(route.get("hm") if route.get("hm") is not None else "")
        ]))
        route_id = base
        suffix = 2
        while route_id in route_ids:
            route_id = f"{base}-{suffix}"
            suffix += 1
        if route_id in route_ids:
            errors.append(f"{name} / route {route_index}: duplicate stable route ID {route_id}")
        route_ids.add(route_id)
        for field in ("km", "hm", "maxh"):
            value = route.get(field)
            if value not in (None, ""):
                try:
                    if float(value) < 0:
                        errors.append(f"{name} / {route_id}: negative {field}")
                    filled[field] += 1
                except (TypeError, ValueError):
                    errors.append(f"{name} / {route_id}: invalid {field}={value!r}")
        date = route.get("date")
        if date:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(date)):
                errors.append(f"{name} / {route_id}: invalid date format {date!r}")
            else:
                filled["date"] += 1
        for field in ("profileUrl", "cutoffUrl"):
            if route.get(field):
                filled[field] += 1

if errors:
    print("\n".join(errors))
    raise SystemExit(f"Data validation failed with {len(errors)} error(s)")

print(f"Validated {len(events)} events and {route_total} routes.")
print("Available route data: " + ", ".join(f"{key}={value}" for key, value in filled.items()))
