"""Classify the freshness and reachability of official event sources."""


def classify_source_check_status(source_status):
    """Summarize source checks without treating manual checks as failures.

    Recognized values are read, partial, manual, unavailable and not-checked.
    A mix of available evidence and unavailable sources is partial. Manual-only
    checks remain manual; unknown values never imply a successful check.
    """
    statuses = {
        str(item.get("status", "")).strip().lower()
        for item in (source_status or [])
        if isinstance(item, dict)
    }
    statuses.discard("")
    if not statuses:
        return "not-checked"

    recognized = {"read", "partial", "manual", "unavailable", "not-checked"}
    known = statuses & recognized
    if not known:
        return "not-checked"
    if known == {"unavailable"}:
        return "unavailable"
    if "unavailable" in known and (known - {"unavailable"}):
        return "partial"
    if "partial" in known:
        return "partial"
    if "read" in known:
        return "read"
    if "manual" in known:
        return "manual"
    return "not-checked"
