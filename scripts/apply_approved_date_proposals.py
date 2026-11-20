#!/usr/bin/env python3
"""Apply only explicitly approved, evidence-backed date proposals to event-dates.json.

Input is a JSON export shaped as {"proposals": [...]}. The script is deliberately
offline and never contacts Supabase or marks proposals as published.
"""
from __future__ import annotations

import argparse
import copy
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ALLOWED_TYPES = {"event_change", "route_change"}


def valid_date(value: object) -> bool:
    if not isinstance(value, str) or not DATE_RE.fullmatch(value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def valid_sources(value: object) -> list[str]:
    if not isinstance(value, list) or not value:
        return []
    result = []
    for url in value:
        if not isinstance(url, str):
            return []
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            return []
        result.append(url)
    return result


def apply_proposals(feed: dict, proposals: list[dict]) -> tuple[dict, dict]:
    updated = copy.deepcopy(feed)
    events = updated.setdefault("events", {})
    report = {"applied": [], "skipped": [], "conflicts": []}

    seen_mutations = set()

    for row in proposals:
        proposal_id = str(row.get("id") or "unknown")
        if row.get("status") != "approved":
            report["skipped"].append({"id": proposal_id, "reason": "not-approved"})
            continue
        proposal_type = row.get("proposal_type")
        payload = row.get("payload")
        if proposal_type not in ALLOWED_TYPES or not isinstance(payload, dict):
            report["skipped"].append({"id": proposal_id, "reason": "unsupported-proposal-type"})
            continue
        if payload.get("source") != "official_event_date_feed":
            report["skipped"].append({"id": proposal_id, "reason": "untrusted-source-kind"})
            continue
        event_id = payload.get("eventId")
        field = payload.get("field")
        new_value = payload.get("newValue")
        sources = valid_sources(payload.get("sources"))
        checked_at = payload.get("checkedAt")
        if not isinstance(event_id, str) or not event_id or not valid_date(new_value) or not sources:
            report["skipped"].append({"id": proposal_id, "reason": "missing-or-invalid-evidence"})
            continue
        target_key = json.dumps([proposal_type, event_id, payload.get("routeId") if proposal_type == "route_change" else field, field, payload.get("oldValue"), new_value], sort_keys=True)
        if target_key in seen_mutations:
            report["skipped"].append({"id": proposal_id, "reason": "duplicate-identical-proposal"})
            continue

        if checked_at:
            try:
                datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
            except (TypeError, ValueError):
                report["skipped"].append({"id": proposal_id, "reason": "invalid-checkedAt"})
                continue

        event = events.get(event_id)
        if not isinstance(event, dict):
            report["conflicts"].append({"id": proposal_id, "reason": "event-not-in-date-feed", "eventId": event_id})
            continue

        if proposal_type == "event_change":
            if field not in {"startDate", "endDate"}:
                report["skipped"].append({"id": proposal_id, "reason": "unsupported-event-field"})
                continue
            period = event.setdefault("eventPeriod", {})
            current = period.get(field)
            if current != payload.get("oldValue"):
                report["conflicts"].append({"id": proposal_id, "reason": "old-value-mismatch", "current": current, "expected": payload.get("oldValue")})
                continue
            period[field] = new_value
            period["verified"] = True
        else:
            if field != "date":
                report["skipped"].append({"id": proposal_id, "reason": "unsupported-route-field"})
                continue
            route_id = payload.get("routeId")
            route_index = str(payload.get("routeIndex", ""))
            routes = event.setdefault("routes", {})
            route = routes.get(route_index)
            if not isinstance(route, dict) or route.get("routeId") != route_id:
                # Route index can shift; resolve by the immutable route ID instead.
                matches = [item for item in routes.values() if isinstance(item, dict) and item.get("routeId") == route_id]
                if len(matches) != 1:
                    report.conflicts.append({"id": proposal_id, "reason": "route-id-not-unique-or-missing", "routeId": route_id})
                    continue
                route = matches[0]
            current = route.get("date")
            if current != payload.get("oldValue"):
                report.conflicts.append({"id": proposal_id, "reason": "old-value-mismatch", "current": current, "expected": payload.get("oldValue")})
                continue
            route["date"] = new_value
            route["verified"] = True
            route["fallback"] = False

        event["status"] = "verified"
        event["checkedAt"] = checked_at or datetime.now(timezone.utc).isoformat()
        existing = event.get("sources", [])
        if not isinstance(existing, list):
            existing = []
        known = {item.get("url") for item in existing if isinstance(item, dict)}
        for url in sources:
            if url not in known:
                existing.append({"url": url, "status": "read", "verification": "owner-approved-date-proposal"})
                known.add(url)
        event["sources"] = existing
        seen_mutations.add(target_key)
        report["applied"].append(proposal_id)

    if report["applied"]:
        updated["updatedAt"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return updated, report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--feed", default="event-dates.json")
    parser.add_argument("--input", default="approved-event-proposals.json")
    parser.add_argument("--output", default="event-dates.proposed.json")
    args = parser.parse_args()

    feed_path, input_path, output_path = map(Path, (args.feed, args.input, args.output))
    feed = json.loads(feed_path.read_text(encoding="utf-8"))
    manifest = json.loads(input_path.read_text(encoding="utf-8"))
    proposals = manifest.get("proposals", [])
    if not isinstance(proposals, list):
        raise SystemExit("Input must contain a proposals array.")

    updated, report = apply_proposals(feed, proposals)
    output_path.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    # Conflicts are a hard stop: a stale approved proposal must never overwrite newer data.
    return 1 if report["conflicts"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
