import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import re
import urllib.request
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
match = re.search(r"const EVENTS=", HTML)
if not match:
    raise SystemExit("EVENTS array not found")
try:
    events, _ = json.JSONDecoder().raw_decode(HTML[match.end():])
except json.JSONDecodeError as exc:
    raise SystemExit(f"EVENTS array is not valid JSON: {exc}")


def slug(value):
    value = str(value or "item").replace("ß", "ss")
    value = "".join(ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn").lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "item"

used_events = set()
for event in events:
    base = slug(event.get("name"))
    event_id = base
    suffix = 2
    while event_id in used_events:
        event_id = f"{base}-{suffix}"
        suffix += 1
    event_id = event.get("id") or event_id
    event["id"] = event_id
    used_events.add(event_id)
    used_routes = set()
    for route in event.get("routes", []):
        route_base = slug("-".join([str(route.get("route") or route.get("name") or "strecke"), str(route.get("km") if route.get("km") is not None else ""), str(route.get("hm") if route.get("hm") is not None else "")]))
        route_id = route_base
        route_suffix = 2
        while route_id in used_routes:
            route_id = f"{route_base}-{route_suffix}"
            route_suffix += 1
        route_id = route.get("id") or route_id
        route["id"] = route_id
        used_routes.add(route_id)

def walk_events(value):
    if isinstance(value, dict):
        types = value.get("@type", [])
        if isinstance(types, str):
            types = [types]
        if any(str(t).lower() == "event" for t in types) and value.get("startDate"):
            yield value
        for child in value.values():
            yield from walk_events(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_events(child)

def parse_date(value):
    if not value:
        return None
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None

def fetch_page(url):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; TrailEventPlanner/1.0)"}
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        return response.read(4_000_000).decode("utf-8", "replace")

def extract_events(page):
    blocks = re.findall(
        r"""<script[^>]+type=['"]application/ld[+]json['"][^>]*>(.*?)</script>""",
        page, re.I | re.S
    )
    found = []
    for block in blocks:
        try:
            found.extend(walk_events(json.loads(block.strip())))
        except (ValueError, TypeError):
            continue
    return [
        {
            "name": str(item.get("name", "")).strip().casefold(),
            "start": parse_date(item.get("startDate")),
            "end": parse_date(item.get("endDate"))
        }
        for item in found if parse_date(item.get("startDate"))
    ]

updated = datetime.now(timezone.utc).isoformat()
today = datetime.now(timezone.utc).date().isoformat()
previous_feed_path = ROOT / "event-dates.json"
try:
    previous_feed = json.loads(previous_feed_path.read_text(encoding="utf-8"))
except (OSError, ValueError):
    previous_feed = {}
previous_events = previous_feed.get("events", {})
feed = {"updatedAt": updated, "schemaVersion": 3, "events": {}}
for event in events:
    previous = previous_events.get(event["id"])
    if not previous:
        continue
    previous = dict(previous)
    valid_route_ids = {route.get("id") for route in event.get("routes", [])}
    previous_routes = {
        key: value for key, value in (previous.get("routes") or {}).items()
        if value.get("routeId") in valid_route_ids and value.get("date") and (value.get("fallback") or value["date"] >= today)
    }
    previous["routes"] = previous_routes
    previous_period = previous.get("eventPeriod")
    if previous_period and previous_period.get("endDate") and previous_period["endDate"] < today:
        previous["eventPeriod"] = None
    if previous.get("status") == "verified" and not previous.get("eventPeriod") and not previous_routes:
        previous["status"] = "unconfirmed"
    feed["events"][event["id"]] = previous

# Manually checked official event pages. Keep these verified periods even when a
# page does not expose machine-readable schema.org Event data.
MANUAL_EVENT_PERIODS = {
    "paris-marathon": ("2027-04-04", "2027-04-04", "https://www.asicsmarathondeparis.com/en/rules-of-the-asics-marathon-de-paris", {"0": "2027-04-04"}),
    "wien-marathon": ("2027-04-18", "2027-04-18", "https://www2.vienna-marathon.com/?go=marathon&lang=de", {"0": "2027-04-18"}),
    "hamburg-marathon": ("2027-04-25", "2027-04-25", "https://haspa-marathon-hamburg.de/teilnehmerinfos-marathon/", {"0": "2027-04-25"}),
    "tcs-london-marathon-major": ("2027-04-24", "2027-04-25", "https://www.londonmarathonevents.co.uk/london-marathon/road-closures", {}),
    "mozart": ("2027-06-05", "2027-06-05", "https://mozart.utmb.world/de/races/mozart100", {"0": "2027-06-05"}),
    "piut": ("2027-07-09", "2027-07-10", "https://www.ischgl.com/de/veranstaltungen-erlebnisse/veranstaltungskalender/piut-paznaun-ischgl-ultra-trail_event_135487129", {}),
    "dolomyths-run": ("2027-07-09", "2027-07-11", "https://dolomythsrun.it/en/", {"0": "2027-07-10", "1": "2027-07-11"}),
    "allgau-panorama-marathon": ("2027-08-07", "2027-08-08", "https://www.allgaeu-panorama-marathon.de/", {"0": "2027-08-08"}),
    "berlin-marathon-major": ("2027-09-26", "2027-09-26", "https://www.generali-berlin-marathon.com/", {"0": "2027-09-26"}),
    "mammutmarsch": ("2027-07-31", "2027-07-31", "https://mammutmarsch.de/events/muenchen", {"0": "2027-07-31"}),
    "megamarsch": ("2027-05-15", "2027-05-16", "https://www.megamarsch.de/m%C3%BCnchen", {"0": "2027-05-15"}),
    "hoka-xtrail-kenting-by-utmb": ("2027-03-05", "2027-03-07", "https://xtrail.utmb.world/registrations", {}),
    "hiroshima-by-utmb": ("2027-04-09", "2027-04-11", "https://hiroshima.utmb.world/runners/event-schedule", {}),
    "the-canyons-endurance-runs-by-utmb": ("2027-04-22", "2027-04-25", "https://canyons.utmb.world/runners/registration", {}),
    "trail-du-saint-jacques-by-utmb": ("2027-06-18", "2027-06-20", "https://saint-jacques.utmb.world/", {}),
    "torrencial-valdivia-by-utmb": ("2027-06-24", "2027-06-27", "https://torrencial.utmb.world/registrations", {}),
    "hoka-val-d-aran-by-utmb": ("2027-07-07", "2027-07-11", "https://valdaran.utmb.world/?page_id=1259", {}),
    "monte-rosa-walser-waeg-by-utmb": ("2027-07-15", "2027-07-18", "https://mrww.utmb.world/", {}),
    "wildstrubel-by-utmb": ("2027-09-09", "2027-09-12", "https://wildstrubel.utmb.world/de", {}),
    "u-tlw": ("2027-07-03", "2027-07-03", "https://utlw.de/en/", {"0": "2027-07-03", "1": "2027-07-03"}),
    "puerto-vallarta-mexico-by-utmb": ("2027-03-04", "2027-03-06", "https://puerto-vallarta.utmb.world/races-runners/runners/registration", {}),
    "transgrancanaria": ("2027-02-23", "2027-02-27", "https://transgrancanaria.net/en/regulations/", {"0": "2027-02-26", "1": "2027-02-27"}),
    "zugspitz-ultratrail": ("2027-06-17", "2027-06-20", "https://zugspitz.utmb.world/", {"0": "2027-06-19", "1": "2027-06-19", "2": "2027-06-18", "3": "2027-06-18", "4": "2027-06-17", "5": "2027-06-18", "6": "2027-06-19"}),
    "3kings-3hills": ("2027-07-23", "2027-07-24", "https://www.3kings-3hills.com/fakten/", {"0": "2027-07-24", "1": "2027-07-24", "2": "2027-07-24", "3": "2027-07-24", "4": "2027-07-24", "5": "2027-07-24", "6": "2027-07-23", "7": "2027-07-23"}),
    "innsbruck-alpine": ("2027-05-05", "2027-05-08", "https://www.innsbruckalpine.at/rennen/alle-bewerbe/", {"0": "2027-05-07", "1": "2027-05-05", "2": "2027-05-05", "3": "2027-05-06", "4": "2027-05-06", "5": "2027-05-08", "6": "2027-05-08", "7": "2027-05-08", "8": "2027-05-06", "9": "2027-05-08", "10": "2027-05-08", "11": "2027-05-08"}),
    "tschirgant-sky": ("2027-06-12", "2027-06-12", "https://tschirgant-sky.run/", {"0": "2027-06-12"}),
    "kaiserkrone": ("2027-06-25", "2027-06-26", "https://www.wilderkaiser.info/de/kaiserkrone-trail.html", {"0": "2027-06-25", "1": "2027-06-26", "2": "2027-06-26", "3": "2027-06-26", "4": "2027-06-26", "5": "2027-06-26"}),
    "kat100": ("2027-08-05", "2027-08-07", "https://kat.utmb.world/de/races", {"0": "2027-08-05", "1": "2027-08-06", "2": "2027-08-07", "3": "2027-08-07", "4": "2027-08-07"}),
}

for event in events:
    route_sources = {}
    for route_index, route in enumerate(event.get("routes", [])):
        url = route.get("web")
        if isinstance(url, str) and urlparse(url).scheme in ("http", "https") and urlparse(url).netloc:
            route_sources.setdefault(url, []).append((route_index, route))
    pages = {}
    source_status = []
    def read_source(item):
        url, route_list = item
        try:
            return url, extract_events(fetch_page(url)), {"url": url, "status": "read"}
        except Exception as error:
            return url, [], {"url": url, "status": "unavailable", "error": str(error)[:160]}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(read_source, item) for item in route_sources.items()]
        for future in as_completed(futures):
            url, records, status_item = future.result()
            pages[url] = records
            source_status.append(status_item)

    event_name = str(event.get("name") or "").strip().casefold()
    event_matches = {
        (record["start"], record["end"])
        for records in pages.values()
        for record in records
        if record["name"] == event_name
    }
    event_period = None
    if len(event_matches) == 1:
        start_date, end_date = next(iter(event_matches))
        if end_date and end_date >= today:
            event_period = {"startDate": start_date, "endDate": end_date, "verified": True}

    route_dates = {}
    conflicting_routes = set()
    for url, route_list in route_sources.items():
        records = pages[url]
        for route_index, route in route_list:
            route_name = str(route.get("route") or route.get("name") or "").strip().casefold()
            matches = {record["start"] for record in records if route_name and record["name"] == route_name and record["start"] and record["start"] >= today}
            if len(matches) == 1:
                date = next(iter(matches))
                route_key = str(route_index)
                existing = route_dates.get(route_key)
                if route_key in conflicting_routes:
                    continue
                if existing is None or existing == date:
                    route_dates[route_key] = date
                else:
                    route_dates.pop(route_key, None)
                    conflicting_routes.add(route_key)

    route_entries = {}
    for route_index, date in route_dates.items():
        route = event["routes"][int(route_index)]
        route_entries[route_index] = {
            "routeId": route["id"],
            "date": date,
            "verified": True
        }

    # If no official 2027 route date is available, retain the previous
    # edition's 2026 date as an explicitly provisional fallback.
    for route_index, route in enumerate(event.get("routes", [])):
        key = str(route_index)
        if key in route_entries:
            continue
        previous_edition_date = str(route.get("date") or "")
        if re.fullmatch(r"2026-\d{2}-\d{2}", previous_edition_date):
            route_entries[key] = {
                "routeId": route["id"],
                "date": previous_edition_date,
                "verified": False,
                "fallback": True,
                "fallbackYear": 2026,
                "note": "Vorläufiger Ersatztermin aus der Ausgabe 2026; kein offizieller Starttermin 2027 gefunden."
            }

    if source_status or route_entries:
        previous = feed["events"].get(event["id"], {})
        previous_period = previous.get("eventPeriod")
        merged_period = event_period or previous_period
        if (
            event_period
            and previous_period
            and event_period.get("startDate", "")[:4] < previous_period.get("startDate", "")[:4]
        ):
            merged_period = previous_period
        if merged_period and merged_period.get("endDate") and merged_period["endDate"] < today:
            merged_period = None

        merged_routes = dict(previous.get("routes") or {})
        for route_key, route_entry in route_entries.items():
            old_route = merged_routes.get(route_key)
            if (
                old_route
                and old_route.get("routeId") == route_entry.get("routeId")
                and old_route.get("date")
                and old_route["date"][:4] > route_entry["date"][:4]
            ):
                continue
            merged_routes[route_key] = route_entry

        valid_route_ids = {route.get("id") for route in event.get("routes", [])}
        merged_routes = {
            key: value for key, value in merged_routes.items()
            if value.get("routeId") in valid_route_ids and value.get("date") and (value.get("fallback") or value["date"] >= today)
        }

        merged_sources = {}
        for source in previous.get("sources", []):
            if source.get("url"):
                merged_sources[source["url"]] = dict(source)
        for source in source_status:
            url = source.get("url")
            if url:
                merged_sources[url] = {**merged_sources.get(url, {}), **source}

        if merged_period or merged_routes:
            status = "verified"
        elif previous.get("status") == "discontinued":
            status = "discontinued"
        elif previous.get("status") in ("unconfirmed", "unavailable"):
            status = previous["status"]
        elif source_status and all(x["status"] == "unavailable" for x in source_status):
            status = "unavailable"
        else:
            status = "unconfirmed"

        record = {
            "eventId": event["id"],
            "checkedAt": updated,
            "status": status,
            "sources": list(merged_sources.values()),
            "eventPeriod": merged_period,
            "routes": merged_routes
        }
        if previous.get("note"):
            record["note"] = previous["note"]
        feed["events"][event["id"]] = record



MANUAL_DISCONTINUED_EVENTS = {
    "brixen-marathon": (
        "https://www.brixenmarathon.com/",
        "Die offiziellen Veranstalterinformationen erklären, dass die Trail-Läufe seit 2022 nicht mehr organisiert werden."
    )
}
MANUAL_UNCONFIRMED_SOURCES = {}

for event_id, (start_date, end_date, source_url, route_dates) in MANUAL_EVENT_PERIODS.items():
    event = next((item for item in events if item["id"] == event_id), None)
    if event is None:
        continue
    record = feed["events"].setdefault(event_id, {
        "eventId": event_id, "checkedAt": updated, "status": "unconfirmed",
        "sources": [], "eventPeriod": None, "routes": {}
    })
    existing_period = record.get("eventPeriod") or {}
    if not existing_period.get("startDate") or start_date[:4] >= existing_period.get("startDate", "")[:4]:
        record["status"] = "verified"
        record["eventPeriod"] = {
            "startDate": start_date, "endDate": end_date, "verified": True
        }
    record["sources"] = [
        item for item in record.get("sources", [])
        if item.get("url") != source_url
    ]
    record.setdefault("sources", []).append({
        "url": source_url, "status": "read", "verification": "manual-official-page"
    })
    record["checkedAt"] = updated
    for route_index, route_date in route_dates.items():
        index = int(route_index)
        if index < len(event.get("routes", [])):
            route = event["routes"][index]
            existing_route = (record.get("routes") or {}).get(route_index, {})
            if not existing_route.get("date") or route_date[:4] >= existing_route.get("date", "")[:4]:
                record.setdefault("routes", {})[route_index] = {
                    "routeId": route["id"], "date": route_date, "verified": True
                }


for event_id, (source_url, note) in MANUAL_DISCONTINUED_EVENTS.items():
    record = feed["events"].setdefault(event_id, {
        "eventId": event_id, "checkedAt": updated, "sources": [], "routes": {}
    })
    record["checkedAt"] = updated
    record["status"] = "discontinued"
    record["eventPeriod"] = None
    record["routes"] = {}
    record["note"] = note
    record["sources"] = [item for item in record.get("sources", []) if item.get("url") != source_url]
    record["sources"].append({
        "url": source_url, "status": "read", "verification": "manual-official-page"
    })

for event_id, source_url in MANUAL_UNCONFIRMED_SOURCES.items():
    record = feed["events"].setdefault(event_id, {
        "eventId": event_id, "checkedAt": updated, "sources": [], "routes": {}
    })
    record["checkedAt"] = updated
    record["status"] = "unconfirmed"
    record["eventPeriod"] = None
    record["routes"] = {}
    record["note"] = "Auf der offiziellen Veranstalterseite wurde noch kein eindeutiger Termin für 2027 gefunden."
    record["sources"] = [item for item in record.get("sources", []) if item.get("url") != source_url]
    record["sources"].append({
        "url": source_url, "status": "read", "verification": "manual-official-page"
    })

(ROOT / "event-dates.json").write_text(
    json.dumps(feed, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
print(f"Checked {len(feed['events'])} events; verified {sum(1 for x in feed['events'].values() if x['status'] == 'verified')} with exact official route matches")
