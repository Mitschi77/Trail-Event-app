import io
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import submit_event_data_proposals as proposals


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class ProposalSubmissionTests(unittest.TestCase):
    def proposal(self, route_id="route-a", source_url="https://example.test/source", title="Candidate"):
        return {
            "proposal_type": "data_correction",
            "title": title,
            "payload": {
                "eventId": "event-1",
                "routeId": route_id,
                "field": "maxh",
                "sourceUrl": source_url,
            },
        }

    def test_deduplicates_same_logical_candidate_but_keeps_distinct_routes_and_sources(self):
        first = self.proposal(title="Old title")
        latest = self.proposal(title="Latest title")
        other_route = self.proposal(route_id="route-b")
        other_source = self.proposal(source_url="https://example.test/other")
        result = proposals.unique_proposals([first, latest, other_route, other_source])
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["title"], "Latest title")

    def test_batch_size_is_bounded(self):
        self.assertEqual(proposals.BATCH_SIZE, 50)

    @patch.object(proposals.time, "sleep")
    @patch.object(proposals.urllib.request, "urlopen")
    def test_retries_transient_http_error_then_succeeds(self, urlopen, _sleep):
        urlopen.side_effect = [
            urllib.error.HTTPError("https://example.test", 429, "Too Many Requests", {}, io.BytesIO(b"retry")),
            FakeResponse(b'{"inserted": 2, "duplicates": 1}'),
        ]
        result = proposals.post_batch([self.proposal()], "jwt", 1)
        self.assertEqual(result["inserted"], 2)
        self.assertEqual(urlopen.call_count, 2)

    @patch.object(proposals.urllib.request, "urlopen")
    def test_does_not_retry_permanent_http_error(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError(
            "https://example.test", 403, "Forbidden", {}, io.BytesIO(b"denied")
        )
        with self.assertRaisesRegex(SystemExit, "HTTP 403"):
            proposals.post_batch([self.proposal()], "jwt", 1)
        self.assertEqual(urlopen.call_count, 1)

    @patch.object(proposals.time, "sleep")
    @patch.object(proposals.urllib.request, "urlopen")
    def test_timeout_is_retried_only_within_limit(self, urlopen, _sleep):
        urlopen.side_effect = TimeoutError("network timeout")
        with self.assertRaisesRegex(SystemExit, "timed out after 5 attempts"):
            proposals.post_batch([self.proposal()], "jwt", 1)
        self.assertEqual(urlopen.call_count, proposals.RETRIES + 1)


if __name__ == "__main__":
    unittest.main()
