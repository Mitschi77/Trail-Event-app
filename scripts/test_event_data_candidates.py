import unittest

from scripts.event_data_candidates import CANDIDATE_PATTERNS, extract_contexts, extract_date_values, missing_candidate_fields


class CandidateExtractionTests(unittest.TestCase):
    def test_german_and_numeric_dates_are_detected(self):
        self.assertTrue(extract_contexts("Start am 9. August 2027 in den Bergen", CANDIDATE_PATTERNS["date"]))
        self.assertTrue(extract_contexts("Termin: 09.08.2027", CANDIDATE_PATTERNS["date"]))

    def test_date_candidates_return_only_exact_date_tokens(self):
        source = "SOLD OUT! Warteliste öffnet am 01/10/2026. Jetzt anmelden. Gebühr 1,50 €."
        self.assertEqual(extract_date_values(source), ["01/10/2026"])
        self.assertNotIn("Warteliste", extract_date_values(source)[0])
        self.assertNotIn("Gebühr", extract_date_values(source)[0])

    def test_multiple_date_tokens_are_deduplicated(self):
        self.assertEqual(
            extract_date_values("Termin 09.08.2027; nochmal 09.08.2027; Ende 10.08.2027"),
            ["09.08.2027", "10.08.2027"]
        )

    def test_start_time_requires_start_context(self):
        self.assertTrue(extract_contexts("Startzeit: 06:30 Uhr", CANDIDATE_PATTERNS["starttime"]))
        self.assertFalse(extract_contexts("Die Pasta-Party beginnt um 18:30 Uhr", CANDIDATE_PATTERNS["starttime"]))

    def test_entry_fee_requires_fee_context(self):
        self.assertTrue(extract_contexts("Startgeld: 85 €", CANDIDATE_PATTERNS["raceCost"]))
        self.assertTrue(extract_contexts("Entry fee EUR 120", CANDIDATE_PATTERNS["raceCost"]))
        self.assertFalse(extract_contexts("Hotel: 120 € pro Nacht", CANDIDATE_PATTERNS["raceCost"]))

    def test_original_context_is_limited(self):
        source = "Startgeld 50 €. " + ("x " * 150) + "Startgeld 60 €. " + ("y " * 150) + "Startgeld 70 €."
        snippets = extract_contexts(source, CANDIDATE_PATTERNS["raceCost"], limit=2)
        self.assertEqual(len(snippets), 2)
        self.assertTrue(all("Startgeld" in snippet for snippet in snippets))

    def test_zero_entry_fee_is_not_missing(self):
        self.assertFalse(missing_candidate_fields({"raceCost": 0})["raceCost"])
        self.assertTrue(missing_candidate_fields({"raceCost": None})["raceCost"])


if __name__ == "__main__":
    unittest.main()
