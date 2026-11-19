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

def filter_shared_gpx_proposals(proposals, distance_tolerance=0.15):
    """Keep shared GPX evidence only for routes whose stored distance matches the track."""
    source_groups = {}
    for proposal in proposals:
        payload = proposal.get("payload") or {}
        if payload.get("field") != "gpxMetrics":
            continue
        source = payload.get("sourceUrl")
        event_id = payload.get("eventId")
        route_id = payload.get("routeId") or payload.get("routeIndex")
        if source and event_id is not None and route_id is not None:
            source_groups.setdefault((event_id, source), []).append(proposal)

    kept = []
    for proposal in proposals:
        payload = proposal.get("payload") or {}
        if payload.get("field") != "gpxMetrics":
            kept.append(proposal)
            continue
        key = (payload.get("eventId"), payload.get("sourceUrl"))
        group = source_groups.get(key, [])
        route_ids = {str((p.get("payload") or {}).get("routeId") or (p.get("payload") or {}).get("routeIndex")) for p in group}
        if len(route_ids) <= 1:
            kept.append(proposal)
            continue
        # A shared GPX is safe only when exactly one route's stored distance
        # matches it. If zero or several routes match, the source-to-route
        # relationship is ambiguous and none of these proposals is emitted.
        matches = []
        for candidate in group:
            candidate_payload = candidate.get("payload") or {}
            old_value = candidate_payload.get("oldValue") or {}
            new_value = candidate_payload.get("newValue") or {}
            try:
                old_km = float(old_value.get("km"))
                new_km = float(new_value.get("km"))
                if old_km > 0 and abs(new_km - old_km) / old_km <= distance_tolerance:
                    matches.append(candidate)
            except (TypeError, ValueError):
                continue
        if len(matches) == 1 and proposal is matches[0]:
            kept.append(proposal)
    return kept

def meaningful_elevation_gain(elevations, ascent, minimum_span_m=5):
    """Return ascent only when the GPX elevation series has a meaningful vertical range."""
    values = [float(value) for value in elevations if value is not None]
    if len(values) < 2 or max(values) - min(values) < minimum_span_m:
        return None
    return round(ascent)
