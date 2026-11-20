import unittest
from scripts.apply_approved_date_proposals import apply_proposals

BASE = {
    "updatedAt": "2026-11-20T00:00:00Z",
    "events": {
        "sample": {
            "status": "verified",
            "checkedAt": "2026-11-01T00:00:00Z",
            "sources": [],
            "eventPeriod": {"startDate": "2026-11-01", "endDate": "2026-11-02", "verified": True},
            "routes": {"0": {"routeId": "sample-50k", "date": "2026-11-01", "verified": True, "fallback": True}}
        }
    }
}

def proposal(pid, typ, payload, status="approved"):
    return {"id": pid, "status": status, "proposal_type": typ, "payload": payload}

class ApprovedDateProposalTests(unittest.TestCase):
    def test_applies_verified_event_and_route_dates(self):
        rows = [
            proposal("event-1", "event_change", {
                "source": "official_event_date_feed", "eventId": "sample",
                "field": "startDate", "oldValue": "2026-11-01", "newValue": "2027-11-01",
                "sources": ["https://organizer.example/race"], "checkedAt": "2026-11-20T12:00:00Z"
            }),
            proposal("route-1", "route_change", {
                "source": "official_event_date_feed", "eventId": "sample", "routeId": "sample-50k",
                "routeIndex": "0", "field": "date", "oldValue": "2026-11-01", "newValue": "2027-11-02",
                "sources": ["https://organizer.example/course"], "checkedAt": "2026-11-20T12:00:00Z"
            })
        ]
        updated, report = apply_proposals(BASE, rows)
        self.assertEqual(report["applied"], ["event-1", "route-1"])
        self.assertEqual(updated["events"]["sample"]["eventPeriod"]["startDate"], "2027-11-01")
        self.assertEqual(updated["events"]["sample"]["routes"]["0"]["date"], "2027-11-02")
        self.assertFalse(updated["events"]["sample"]["routes"]["0"]["fallback"])
        self.assertEqual(BASE["events"]["sample"]["eventPeriod"]["startDate"], "2026-11-01")

    def test_skips_unapproved_and_non_date_types(self):
        rows = [
            proposal("pending", "event_change", {}, status="pending"),
            proposal("metrics", "data_correction", {"source": "automated_event_data_finder"})
        ]
        updated, report = apply_proposals(BASE, rows)
        self.assertEqual(report["applied"], [])
        self.assertEqual(len(report["skipped"]), 2)
        self.assertEqual(updated["events"]["sample"]["eventPeriod"]["startDate"], "2026-11-01")

    def test_conflict_stops_stale_overwrite(self):
        rows = [proposal("stale", "event_change", {
            "source": "official_event_date_feed", "eventId": "sample", "field": "startDate",
            "oldValue": "2026-10-31", "newValue": "2027-11-01",
            "sources": ["https://organizer.example/race"]
        })]
        updated, report = apply_proposals(BASE, rows)
        self.assertEqual(report["applied"], [])
        self.assertEqual(report["conflicts"][0]["reason"], "old-value-mismatch")
        self.assertEqual(updated["events"]["sample"]["eventPeriod"]["startDate"], "2026-11-01")

    def test_rejects_non_https_sources_and_invalid_dates(self):
        rows = [proposal("bad", "event_change", {
            "source": "official_event_date_feed", "eventId": "sample", "field": "startDate",
            "oldValue": "2026-11-01", "newValue": "not-a-date",
            "sources": ["http://organizer.example/race"]
        })]
        updated, report = apply_proposals(BASE, rows)
        self.assertEqual(report["applied"], [])
        self.assertEqual(report["skipped"][0]["reason"], "missing-or-invalid-evidence")
        self.assertEqual(updated["events"]["sample"]["eventPeriod"]["startDate"], "2026-11-01")

if __name__ == "__main__":
    unittest.main()
