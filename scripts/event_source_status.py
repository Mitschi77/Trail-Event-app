"""Classify the freshness and reachability of official event sources."""


def classify_source_check_status(source_status):
    """Summarize the latest automatic checks without erasing prior date evidence."""
    statuses = [item.get("status") for item in (source_status or [])]
    if not statuses:
        return "not-checked"
    if all(status == "unavailable" for status in statuses):
        return "unavailable"
    if any(status == "unavailable" for status in statuses):
        return "partial"
    if any(status == "read" for status in statuses):
        return "read"
    return "not-checked"
