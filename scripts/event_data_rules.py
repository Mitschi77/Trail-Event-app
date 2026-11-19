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
