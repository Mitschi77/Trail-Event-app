import unittest
from validate_event_data import valid_iso_timestamp

from scripts.event_source_status import classify_source_check_status


class SourceCheckStatusTests(unittest.TestCase):
    def test_no_sources_is_not_checked(self):
        self.assertEqual(classify_source_check_status([]), "not-checked")

    def test_all_sources_unavailable(self):
        self.assertEqual(classify_source_check_status([{"status": "unavailable"}, {"status": "unavailable"}]), "unavailable")

    def test_unknown_status_does_not_hide_unavailable_sources(self):
        self.assertEqual(classify_source_check_status([
            {"status": "unavailable"}, {"status": "future-status"}
        ]), "unavailable")

    def test_unknown_status_does_not_hide_read_sources(self):
        self.assertEqual(classify_source_check_status([
            {"status": "read"}, {"status": "future-status"}
        ]), "read")

    def test_empty_and_non_dict_entries_are_ignored(self):
        self.assertEqual(classify_source_check_status([
            None, "read", {}, {"status": "  "}
        ]), "not-checked")

    def test_mixed_read_and_unavailable_is_partial(self):
        self.assertEqual(classify_source_check_status([{"status": "read"}, {"status": "unavailable"}]), "partial")

    def test_mixed_manual_and_unavailable_is_partial(self):
        self.assertEqual(classify_source_check_status([{"status": "manual"}, {"status": "unavailable"}]), "partial")

    def test_successful_source_is_read(self):
        self.assertEqual(classify_source_check_status([{"status": "read"}]), "read")

    def test_manual_only_is_manual(self):
        self.assertEqual(classify_source_check_status([{"status": "manual"}]), "manual")

    def test_partial_is_preserved(self):
        self.assertEqual(classify_source_check_status([{"status": "partial"}]), "partial")

    def test_manual_and_read_is_read(self):
        self.assertEqual(classify_source_check_status([{"status": "manual"}, {"status": "read"}]), "read")

    def test_unknown_status_does_not_claim_success(self):
        self.assertEqual(classify_source_check_status([{"status": "unknown"}]), "not-checked")

    def test_mixed_unknown_and_manual_preserves_manual(self):
        self.assertEqual(classify_source_check_status([{"status": "unknown"}, {"status": "manual"}]), "manual")

    def test_iso_timestamp_validation(self):
        self.assertTrue(valid_iso_timestamp("2026-11-20T17:00:00Z"))
        self.assertTrue(valid_iso_timestamp("2026-11-20T17:00:00.123456+00:00"))
        self.assertTrue(valid_iso_timestamp("2026-11-20T18:00:00+01:00"))
        self.assertFalse(valid_iso_timestamp("2026-11-20T17:00:00"))
        self.assertFalse(valid_iso_timestamp("2026-11-20"))
        self.assertFalse(valid_iso_timestamp("2026-13-45T99:99:99Z"))
        self.assertFalse(valid_iso_timestamp("not-a-timestamp"))
        self.assertFalse(valid_iso_timestamp(None))


if __name__ == "__main__":
    unittest.main()
