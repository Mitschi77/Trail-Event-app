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
match = re.search(r"const EVENTS=(\[.*?\]);\s*(?:let userAddedEvents|const userAddedEvents)", HTML, re.S)
if not match:
    raise SystemExit("EVENTS array not found")
events = json.loads(match.group(1))

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
    return [(str(item.get("name", "")).strip().casefold(), parse_date(item.get("startDate")))
            for item in found if parse_date(item.get("startDate"))]

updated = datetime.now(timezone.utc).isoformat()
feed = {"updatedAt": updated, "schemaVersion": 2, "events": {}}

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

    route_dates = {}
    conflicting_routes = set()
    for url, route_list in route_sources.items():
        records = pages[url]
        for route_index, route in route_list:
            route_name = str(route.get("route") or route.get("name") or "").strip().casefold()
            event_name = str(event.get("name") or "").strip().casefold()
            matches = {date for name, date in records if route_name and name == route_name}
            # Do not assign an event-period date to a differently named placeholder route.
            # Event-title matching is valid only when the route itself has that exact name.
            if not matches and route_name == event_name and event_name:
                matches = {date for name, date in records if name == event_name}
            if len(matches) == 1:
                date = next(iter(matches))
                existing = route_dates.get(str(route_index))
                route_key = str(route_index)
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

    status = "verified" if route_entries else (
        "unavailable" if source_status and all(x["status"] == "unavailable" for x in source_status)
        else "unconfirmed"
    )
    if source_status or route_entries:
        feed["events"][event["id"]] = {
            "eventId": event["id"],
            "checkedAt": updated,
            "status": status,
            "sources": source_status,
            "routes": route_entries
        }

(ROOT / "event-dates.json").write_text(
    json.dumps(feed, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
print(f"Checked {len(feed['events'])} events; verified {sum(1 for x in feed['events'].values() if x['status'] == 'verified')} with exact official route matches")
