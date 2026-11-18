"""Pure helpers for conservative event-page candidate extraction."""
import re

CANDIDATE_PATTERNS = {
    "date": r"\\b(?:\\d{1,2}[./]\\d{1,2}[./](?:20)?\\d{2}|\\d{1,2}\\.\\s*(?:jan(?:uar)?|feb(?:ruar)?|märz|mar(?:ch)?|apr(?:il)?|mai|may|jun(?:i|e)?|jul(?:i|y)?|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)(?:\\s+20\\d{2})?)\\b",
    "starttime": r"\\b(?:startzeit|start time|startschuss|wave start|mass start|start)\\b[^.!?]{0,100}\\b\\d{1,2}[:.]\\d{2}\\s*(?:uhr|am|pm)?",
    "raceCost": r"\\b(?:startgeld|nenngeld|teilnahmegebühr|entry fee|registration fee|race fee|registration|early bird)\\b[^.!?]{0,120}(?:\\d{2,4}(?:[.,]\\d{1,2})?\\s?(?:€|eur|chf|usd|\\$)|(?:€|eur|chf|usd|\\$)\\s?\\d{2,4}(?:[.,]\\d{1,2})?)",
}


def extract_contexts(text, pattern, limit=4, before=100, after=140):
    """Return unique original-text snippets around regex hits."""
    found = []
    for match in re.finditer(pattern, text, re.I):
        snippet = text[max(0, match.start() - before):min(len(text), match.end() + after)].strip()
        if snippet and snippet not in found:
            found.append(snippet)
        if len(found) >= limit:
            break
    return found


def missing_candidate_fields(route):
    """Yield fields whose values are genuinely absent, not merely falsey."""
    return {
        "date": not route.get("date"),
        "starttime": not route.get("starttime"),
        "raceCost": route.get("raceCost") in (None, ""),
    }
