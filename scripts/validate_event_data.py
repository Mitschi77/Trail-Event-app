import json
import math
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
match = re.search(r"const EVENTS=(\[.*?\]);\s*let userAddedEvents", HTML, re.S)
if not match:
    raise SystemExit("EVENTS array not found")
events = json.loads(match.group(1))


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


errors = []
warnings = []
event_ids = set()
route_total = 0
filled = {"km": 0, "hm": 0, "maxh": 0, "date": 0, "profileUrl": 0, "cutoffUrl": 0}
missing = {"km": 0, "hm": 0, "maxh": 0, "date": 0, "start": 0, "country": 0}

for event_index, event in enumerate(events):
    name = str(event.get("name") or "").strip()
    if not name:
        errors.append(f"Event {event_index}: missing name")

    event_id = event.get("id")
    if not event_id:
        errors.append(f"{name}: missing persisted event ID")
    elif event_id in event_ids:
        errors.append(f"{name}: duplicate event ID {event_id!r}")
    else:
        event_ids.add(event_id)

    if event.get("date") and not valid_date(event["date"]):
        errors.append(f"{name}: invalid event date {event['date']!r}")
    if event.get("endDate") and not valid_date(event["endDate"]):
        errors.append(f"{name}: invalid event end date {event['endDate']!r}")
    if event.get("date") and event.get("endDate") and valid_date(event["date"]) and valid_date(event["endDate"]) and event["endDate"] < event["date"]:
        errors.append(f"{name}: event end date precedes start date")

    routes = event.get("routes")
    if not isinstance(routes, list) or not routes:
        errors.append(f"{name}: no routes")
        continue

    route_ids = set()
    valid_km = []
    valid_hm = []
    for route_index, route in enumerate(routes):
        route_total += 1
        route_id = route.get("id")
        if not route_id:
            errors.append(f"{name} / route {route_index}: missing persisted route ID")
        elif route_id in route_ids:
            errors.append(f"{name} / route {route_index}: duplicate route ID {route_id!r}")
        else:
            route_ids.add(route_id)

        for field in ("km", "hm", "maxh"):
            value = route.get(field)
            if value in (None, ""):
                missing[field] += 1
                continue
            try:
                numeric = float(value)
                if not math.isfinite(numeric) or numeric < 0:
                    errors.append(f"{name} / {route_id}: invalid or negative {field}={value!r}")
                    continue
                filled[field] += 1
                if field == "km" and numeric > 0:
                    valid_km.append(numeric)
                if field == "hm":
                    valid_hm.append(numeric)
                if field == "km" and numeric > 300:
                    warnings.append(f"{name} / {route_id}: unusually long distance {numeric:g} km – please verify")
                if field == "hm" and numeric > 15000:
                    warnings.append(f"{name} / {route_id}: unusually high elevation gain {numeric:g} hm – please verify")
                if field == "maxh" and numeric > 240:
                    warnings.append(f"{name} / {route_id}: unusually long time limit {numeric:g} h – please verify")
            except (TypeError, ValueError):
                errors.append(f"{name} / {route_id}: invalid {field}={value!r}")

        route_date = route.get("date")
        if route_date:
            if not valid_date(route_date):
                errors.append(f"{name} / {route_id}: invalid calendar date {route_date!r}")
            else:
                filled["date"] += 1
        else:
            missing["date"] += 1

        if not route.get("start") and not event.get("start"):
            missing["start"] += 1
        if not route.get("country") and not event.get("country"):
            missing["country"] += 1
        for field in ("profileUrl", "cutoffUrl"):
            if route.get(field):
                filled[field] += 1

    expected_min_km = min(valid_km) if valid_km else None
    expected_max_hm = max(valid_hm) if valid_hm else None
    if event.get("minKm") != expected_min_km:
        errors.append(f"{name}: minKm summary {event.get('minKm')!r} does not match route minimum {expected_min_km!r}")
    if event.get("maxHm") != expected_max_hm:
        errors.append(f"{name}: maxHm summary {event.get('maxHm')!r} does not match route maximum {expected_max_hm!r}")

if errors:
    print("\n".join(errors))
    raise SystemExit(f"Data validation failed with {len(errors)} error(s)")

print(f"Validated {len(events)} events and {route_total} routes with persisted unique IDs.")
print("Available route data: " + ", ".join(f"{key}={value}" for key, value in filled.items()))
print("Missing optional data: " + ", ".join(f"{key}={value}" for key, value in missing.items()))
if warnings:
    print(f"Review warnings: {len(warnings)}")
    for warning in warnings[:30]:
        print("WARNING: " + warning)
    if len(warnings) > 30:
        print(f"... and {len(warnings) - 30} more warning(s)")
else:
    print("No unusual route values detected.")
