import unittest

from scripts.event_data_candidates import CANDIDATE_PATTERNS, extract_contexts, extract_date_values, extract_race_cost_values, extract_starttime_values, missing_candidate_fields


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

    def test_start_time_candidates_contain_only_normalized_clock_values(self):
        source = "Startzeit: 6:30 Uhr. Weitere Infos zum Ablauf und zur Anmeldung."
        self.assertEqual(extract_starttime_values(source), ["06:30"])
        self.assertEqual(extract_starttime_values("Die Pasta-Party beginnt um 18:30 Uhr"), [])

    def test_entry_fee_candidates_contain_only_amount_and_currency(self):
        self.assertEqual(extract_race_cost_values("Startgeld: 85 € inklusive Verpflegung"), ["85 €"])
        self.assertEqual(extract_race_cost_values("Entry fee EUR 120,00. Hotel 95 €"), ["120,00 €"])
        self.assertEqual(extract_race_cost_values("Hotel: 120 € pro Nacht"), [])

    def test_original_context_is_limited(self):
        source = "Startgeld 50 €. " + ("x " * 150) + "Startgeld 60 €. " + ("y " * 150) + "Startgeld 70 €."
        snippets = extract_contexts(source, CANDIDATE_PATTERNS["raceCost"], limit=2)
        self.assertEqual(len(snippets), 2)
        self.assertTrue(all("Startgeld" in snippet for snippet in snippets))

    def test_zero_entry_fee_is_not_missing(self):
        self.assertFalse(missing_candidate_fields({"raceCost": 0})["raceCost"])
        self.assertTrue(missing_candidate_fields({"raceCost": None})["raceCost"])

    def test_profile_candidate_requires_labelled_embedded_svg_and_never_returns_coordinates(self):
        from scripts.event_data_candidates import extract_profile_candidates
        html = '<svg aria-label="Höhenprofil"><polyline points="0,100 20,80 40,30"/></svg>'
        result = extract_profile_candidates(html)
        self.assertEqual(len(result), 1)
        self.assertIn("Höhenprofil", result[0])
        self.assertNotIn("0,100", result[0])
        self.assertEqual(extract_profile_candidates('<svg><polyline points="0,100 20,80"/></svg>'), [])

    def test_timechart_candidate_requires_explicit_checkpoint_or_timechart_label(self):
        from scripts.event_data_candidates import extract_timechart_candidates
        self.assertTrue(extract_timechart_candidates("Checkpoint times: KM 20 10:30; KM 40 13:00"))
        self.assertEqual(extract_timechart_candidates("Start 10:30, Pasta party 18:00"), [])


if __name__ == "__main__":
    unittest.main()
