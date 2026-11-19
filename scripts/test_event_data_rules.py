import unittest
from event_data_rules import extract_cutoff_hours, is_http_url

class EventDataRulesTests(unittest.TestCase):
    def test_time_limit_before_value(self):
        self.assertEqual(extract_cutoff_hours("Zeitlimit: 44 Stunden"), 44)

    def test_value_before_time_limit(self):
        self.assertEqual(extract_cutoff_hours("44h Zeitlimit"), 44)

    def test_decimal_hours(self):
        self.assertEqual(extract_cutoff_hours("time limit 12.5 hours"), 12.5)

    def test_unlabelled_duration_is_not_a_cutoff(self):
        self.assertIsNone(extract_cutoff_hours("The event lasts 44 hours"))

    def test_http_url_validation(self):
        self.assertTrue(is_http_url("https://example.org/race"))
        self.assertFalse(is_http_url("Trail & Tarmac Pursuit"))
        self.assertFalse(is_http_url("javascript:alert(1)"))

if __name__ == "__main__":
    unittest.main()
