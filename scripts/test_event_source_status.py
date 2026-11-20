import unittest

from event_source_status import build_source_check_metadata


class SourceCheckStatusTests(unittest.TestCase):
    def test_all_sources_read(self):
        self.assertEqual(
            build_source_check_metadata([{"status": "read"}], {}, "2026-11-20"),
            {"sourceCheckStatus": "read", "lastSuccessfulSourceCheckAt": "2026-11-20"},
        )

    def test_partial_failure_keeps_latest_success(self):
        self.assertEqual(
            build_source_check_metadata(
                [{"status": "read"}, {"status": "unavailable"}],
                {"lastSuccessfulSourceCheckAt": "2026-11-19"},
                "2026-11-20",
            ),
            {"sourceCheckStatus": "partial", "lastSuccessfulSourceCheckAt": "2026-11-20"},
        )

    def test_all_sources_unavailable_preserves_last_success(self):
        self.assertEqual(
            build_source_check_metadata(
                [{"status": "unavailable"}, {"status": "unavailable"}],
                {"lastSuccessfulSourceCheckAt": "2026-11-19"},
                "2026-11-20",
            ),
            {"sourceCheckStatus": "unavailable", "lastSuccessfulSourceCheckAt": "2026-11-19"},
        )

    def test_empty_source_list_is_not_checked(self):
        self.assertEqual(
            build_source_check_metadata([], {"lastSuccessfulSourceCheckAt": "2026-11-19"}, "2026-11-20"),
            {"sourceCheckStatus": "not-checked", "lastSuccessfulSourceCheckAt": "2026-11-19"},
        )


if __name__ == "__main__":
    unittest.main()
