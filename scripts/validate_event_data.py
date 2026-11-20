import json
import math
import re
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
match = re.search(r"const EVENTS=", HTML)
if not match:
    raise SystemExit("EVENTS array not found")
try:
    events, _ = json.JSONDecoder().raw_decode(HTML[match.end():])
except json.JSONDecodeError as exc:
    raise SystemExit(f"EVENTS array is not valid JSON: {exc}")
feed = json.loads((ROOT / 'event-dates.json').read_text(encoding='utf-8'))
feed_events = feed.get('events', {})


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def valid_iso_timestamp(value):
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


errors = []
warnings = []
event_ids = set()
route_ids_global = set()
event_route_ids = {}
events_by_id = {event.get("id"): event for event in events if event.get("id")}
route_total = 0
filled = {"km": 0, "hm": 0, "maxh": 0, "date": 0, "profileUrl": 0, "cutoffUrl": 0, "profileData": 0, "cutoffData": 0}
missing = {"km": 0, "hm": 0, "maxh": 0, "date": 0, "start": 0, "startLocation": 0, "country": 0, "profileData": 0, "cutoffData": 0}

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
    event_route_ids[event_id] = route_ids
    valid_km = []
    valid_hm = []
    for route_index, route in enumerate(routes):
        route_total += 1
        route_id = route.get("id")
        if not route_id:
            errors.append(f"{name} / route {route_index}: missing persisted route ID")
        elif route_id in route_ids:
            errors.append(f"{name} / route {route_index}: duplicate route ID {route_id!r}")
        elif route_id in route_ids_global:
            errors.append(f"{name} / route {route_index}: route ID is duplicated across events {route_id!r}")
        else:
            route_ids.add(route_id)
            route_ids_global.add(route_id)

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
        if not route.get("startLocation") and not event.get("startLocation"):
            missing["startLocation"] += 1
        if not route.get("country") and not event.get("country"):
            missing["country"] += 1
        for field in ("profileUrl", "cutoffUrl"):
            if route.get(field):
                filled[field] += 1
        profile_url = str(route.get("profileUrl") or "")
        profile_path = profile_url.split("?", 1)[0].split("#", 1)[0].lower()
        has_profile = bool(route.get("elevationProfile") or route.get("profilePoints") or profile_path.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")))
        if has_profile:
            filled["profileData"] += 1
        else:
            missing["profileData"] += 1
        has_cutoff_data = bool(route.get("cutoffs"))
        try:
            has_cutoff_data = has_cutoff_data or float(route.get("maxh") or 0) > 0
        except (TypeError, ValueError):
            pass
        if has_cutoff_data:
            filled["cutoffData"] += 1
        else:
            missing["cutoffData"] += 1

    expected_min_km = min(valid_km) if valid_km else None
    expected_max_hm = max(valid_hm) if valid_hm else None
    if event.get("minKm") != expected_min_km:
        warnings.append(f"{name}: minKm summary {event.get('minKm')!r} does not match route minimum {expected_min_km!r}")
    # A stored event-level 0 is used as an unknown/empty summary when no
    # route has elevation data. Do not report that sentinel as a mismatch.
    reported_max_hm = event.get("maxHm")
    if expected_max_hm is not None and reported_max_hm != expected_max_hm:
        warnings.append(f"{name}: maxHm summary {reported_max_hm!r} does not match route maximum {expected_max_hm!r}")
    elif expected_max_hm is None and reported_max_hm not in (None, 0):
        warnings.append(f"{name}: maxHm summary {reported_max_hm!r} exists but no route has elevation data")


missing_feed_events = event_ids - set(feed_events)
for missing_id in sorted(missing_feed_events):
    errors.append(f"{missing_id}: missing event-dates.json entry")
for feed_event_id, feed_record in feed_events.items():
    checked_at = feed_record.get("checkedAt")
    if checked_at and not valid_iso_timestamp(checked_at):
        errors.append(f"{feed_event_id}: checkedAt must be a valid ISO timestamp")
    source_check = feed_record.get("sourceCheckStatus")
    if source_check and source_check not in ("read", "partial", "unavailable", "not-checked", "manual"):
        errors.append(f"{feed_event_id}: invalid sourceCheckStatus {source_check!r}")
    last_success = feed_record.get("lastSuccessfulSourceCheckAt")
    if last_success and not valid_iso_timestamp(last_success):
        errors.append(f"{feed_event_id}: lastSuccessfulSourceCheckAt must be a valid ISO timestamp")
    if feed_record.get("status") == "verified":
        period = feed_record.get("eventPeriod") or {}
        has_verified_period = bool(period.get("verified") and period.get("startDate"))
        has_verified_route = any(item.get("verified") and item.get("date") for item in (feed_record.get("routes") or {}).values())
        if not (has_verified_period or has_verified_route):
            warnings.append(f"{feed_event_id}: status is verified but no verified event period or route date is present")
    if feed_event_id not in event_ids:
        warnings.append(f"event-dates.json contains stale event ID {feed_event_id!r}")
        continue
    period = feed_record.get("eventPeriod") or {}
    if period.get("startDate") and not valid_date(period["startDate"]):
        errors.append(f"{feed_event_id}: invalid feed event start date {period['startDate']!r}")
    if period.get("endDate") and not valid_date(period["endDate"]):
        errors.append(f"{feed_event_id}: invalid feed event end date {period['endDate']!r}")
    if period.get("startDate") and period.get("endDate") and valid_date(period["startDate"]) and valid_date(period["endDate"]) and period["endDate"] < period["startDate"]:
        errors.append(f"{feed_event_id}: feed event end date precedes start date")
    seen_feed_route_ids = set()
    current_routes = events_by_id[feed_event_id].get("routes") or []
    for route_index, feed_route in (feed_record.get("routes") or {}).items():
        route_id = feed_route.get("routeId")
        if route_id not in event_route_ids.get(feed_event_id, set()):
            warnings.append(f"{feed_event_id}: stale feed route ID {route_id!r} (not present in current event list)")
        if route_id and route_id in seen_feed_route_ids:
            warnings.append(f"{feed_event_id}: duplicate feed entry for route ID {route_id!r}")
        if route_id:
            seen_feed_route_ids.add(route_id)
        try:
            numeric_index = int(route_index)
            indexed_route = current_routes[numeric_index] if 0 <= numeric_index < len(current_routes) else None
        except (TypeError, ValueError):
            indexed_route = None
        if indexed_route is None:
            warnings.append(f"{feed_event_id}: feed route index {route_index!r} is not a valid current route position")
        elif route_id and indexed_route.get("id") != route_id:
            warnings.append(
                f"{feed_event_id}: feed index {route_index} now points to {indexed_route.get('id')!r}, "
                f"but stable routeId is {route_id!r}; app must resolve by routeId"
            )
        if feed_route.get("date") and not valid_date(feed_route["date"]):
            errors.append(f"{feed_event_id} / {route_id}: invalid feed route date {feed_route['date']!r}")

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
