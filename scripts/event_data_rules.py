"""Conservative parsers for official event-data evidence."""
import re
from urllib.parse import urlparse

_CUTOFF_PATTERNS = (
    re.compile(r"(?i)(?:cut[\s-]?off|time\s*limit|zeitlimit|max(?:imum)?\s*time|maximalzeit|schlusszeit|zeitbeschränkung)\s*[:：-]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:h|hours?|stunden?)\b"),
    re.compile(r"(?i)(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:h|hours?|stunden?)\s*(?:cut[\s-]?off|time\s*limit|zeitlimit)\b"),
)

def is_http_url(value):
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)

def extract_cutoff_hours(text):
    """Return hours only when a number is explicitly tied to a time-limit label."""
    if not isinstance(text, str):
        return None
    for pattern in _CUTOFF_PATTERNS:
        match = pattern.search(text)
        if match:
            try:
                value = float(match.group(1).replace(",", "."))
            except ValueError:
                continue
            if 0 < value <= 1000:
                return value
    return None

def filter_shared_gpx_proposals(proposals):
    """Drop GPX metric proposals when one source file is assigned to multiple routes of one event."""
    source_routes = {}
    for proposal in proposals:
        payload = proposal.get("payload") or {}
        if payload.get("field") != "gpxMetrics":
            continue
        source = payload.get("sourceUrl")
        event_id = payload.get("eventId")
        route_id = payload.get("routeId") or payload.get("routeIndex")
        if source and event_id is not None and route_id is not None:
            source_routes.setdefault((event_id, source), set()).add(str(route_id))

    shared = {
        key for key, route_ids in source_routes.items()
        if len(route_ids) > 1
    }
    kept = []
    for proposal in proposals:
        payload = proposal.get("payload") or {}
        key = (payload.get("eventId"), payload.get("sourceUrl"))
        if payload.get("field") == "gpxMetrics" and key in shared:
            continue
        kept.append(proposal)
    return kept

def meaningful_elevation_gain(elevations, ascent, minimum_span_m=5):
    """Return ascent only when the GPX elevation series has a meaningful vertical range."""
    values = [float(value) for value in elevations if value is not None]
    if len(values) < 2 or max(values) - min(values) < minimum_span_m:
        return None
    return round(ascent)
