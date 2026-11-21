"""Track the health of official event-date source checks without losing prior successes."""

def build_source_check_metadata(source_status, previous, checked_at):
    statuses = [item.get("status") for item in source_status]
    has_success = any(status == "read" for status in statuses)
    has_failure = any(status == "unavailable" for status in statuses)
    if statuses and all(status == "unavailable" for status in statuses):
        current_status = "unavailable"
    elif has_failure:
        current_status = "partial"
    elif has_success:
        current_status = "read"
    else:
        current_status = "not-checked"

    return {
        "sourceCheckStatus": current_status,
        "lastSuccessfulSourceCheckAt": (
            checked_at if has_success
            else previous.get("lastSuccessfulSourceCheckAt")
        ),
    }
