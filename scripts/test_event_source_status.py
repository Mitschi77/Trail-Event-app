import unittest

from scripts.event_source_status import classify_source_check_status


class SourceCheckStatusTests(unittest.TestCase):
    def test_no_sources_is_not_checked(self):
        self.assertEqual(classify_source_check_status([]), "not-checked")

    def test_all_sources_unavailable(self):
        self.assertEqual(classify_source_check_status([{"status": "unavailable"}, {"status": "unavailable"}]), "unavailable")

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


if __name__ == "__main__":
    unittest.main()
