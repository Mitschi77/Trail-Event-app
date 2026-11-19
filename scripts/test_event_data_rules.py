import unittest
from scripts.event_data_rules import extract_cutoff_hours, filter_shared_gpx_proposals, is_http_url, meaningful_elevation_gain

class EventDataRulesTests(unittest.TestCase):
    def test_time_limit_before_value(self):
        self.assertEqual(extract_cutoff_hours("Zeitlimit: 44 Stunden"), 44)

    def test_value_before_time_limit(self):
        self.assertEqual(extract_cutoff_hours("44h Zeitlimit"), 44)

    def test_decimal_hours(self):
        self.assertEqual(extract_cutoff_hours("time limit 12.5 hours"), 12.5)

    def test_unlabelled_duration_is_not_a_cutoff(self):
        self.assertIsNone(extract_cutoff_hours("The event lasts 44 hours"))


    def test_shared_gpx_source_is_not_assigned_to_multiple_routes(self):
        proposals = [
            {"payload": {"field": "gpxMetrics", "eventId": "race", "routeId": "a", "sourceUrl": "https://example.org/course.gpx"}},
            {"payload": {"field": "gpxMetrics", "eventId": "race", "routeId": "b", "sourceUrl": "https://example.org/course.gpx"}},
            {"payload": {"field": "maxh", "eventId": "race", "routeId": "a", "sourceUrl": "https://example.org/race"}},
        ]
        self.assertEqual(filter_shared_gpx_proposals(proposals), [proposals[2]])

    def test_same_gpx_url_for_different_events_is_not_a_conflict(self):
        proposals = [
            {"payload": {"field": "gpxMetrics", "eventId": "race-a", "routeId": "a", "sourceUrl": "https://example.org/course.gpx"}},
            {"payload": {"field": "gpxMetrics", "eventId": "race-b", "routeId": "b", "sourceUrl": "https://example.org/course.gpx"}},
        ]
        self.assertEqual(filter_shared_gpx_proposals(proposals), proposals)

    def test_unique_route_gpx_source_is_kept(self):
        proposal = {"payload": {"field": "gpxMetrics", "eventId": "race", "routeId": "a", "sourceUrl": "https://example.org/a.gpx"}}
        self.assertEqual(filter_shared_gpx_proposals([proposal]), [proposal])


    def test_flat_zero_elevation_is_not_treated_as_real_elevation(self):
        self.assertIsNone(meaningful_elevation_gain([0, 0, 0, 0], 0))

    def test_meaningful_elevation_range_keeps_ascent(self):
        self.assertEqual(meaningful_elevation_gain([100, 120, 160], 75.4), 75)

    def test_http_url_validation(self):
        self.assertTrue(is_http_url("https://example.org/race"))
        self.assertFalse(is_http_url("Trail & Tarmac Pursuit"))
        self.assertFalse(is_http_url("javascript:alert(1)"))

if __name__ == "__main__":
    unittest.main()
