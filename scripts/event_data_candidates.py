"""Conservative text candidates from official event pages; never normalizes or applies values."""
import re

CANDIDATE_PATTERNS = {
    "date": re.compile(r"(?i)\b(?:\d{1,2}[./]\d{1,2}[./](?:20)?\d{2}|\d{1,2}\.\s*(?:jan(?:uar)?|feb(?:ruar)?|märz|mar(?:ch)?|apr(?:il)?|mai|may|jun(?:i|e)?|jul(?:i|y)?|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)(?:\s+20\d{2})?)\b"),
    "starttime": re.compile(r"(?i)\b(?:startzeit|start time|startschuss|wave start|mass start)\b[^.!?\n]{0,100}\b\d{1,2}[:.]\d{2}\s*(?:uhr|am|pm)?"),
    "raceCost": re.compile(r"(?i)\b(?:startgeld|nenngeld|teilnahmegebühr|entry fee|registration fee|race fee|early bird)\b[^.!?\n]{0,120}(?:\d{2,4}(?:[.,]\d{1,2})?\s?(?:€|eur|chf|usd|\$)|(?:€|eur|chf|usd|\$)\s?\d{2,4}(?:[.,]\d{1,2})?)"),
}

def extract_contexts(text, pattern, limit=4, before=100, after=140):
    found = []
    source = text or ""
    for match in pattern.finditer(source):
        snippet = source[max(0, match.start()-before):min(len(source), match.end()+after)].strip()
        if snippet and snippet not in found:
            found.append(snippet)
        if len(found) >= limit:
            break
    return found

def missing_candidate_fields(route):
    return {
        "date": not route.get("date"),
        "starttime": not route.get("starttime"),
        "raceCost": route.get("raceCost") in (None, ""),
    }


def extract_date_values(text, limit=4):
    """Return only exact date tokens, never the surrounding page paragraph."""
    found = []
    for match in CANDIDATE_PATTERNS["date"].finditer(text or ""):
        value = match.group(0).strip()
        if value and value not in found:
            found.append(value)
        if len(found) >= limit:
            break
    return found


TIME_VALUE_PATTERN = re.compile(r"(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)")
MONEY_VALUE_PATTERN = re.compile(
    r"(?:(?P<amount>(?:\d{1,3}(?:[ .]\d{3})+|\d{2,4})(?:[,.]\d{1,2})?)\s*(?P<currency>€|eur|chf|usd|\$)"
    r"|(?P<currency_prefix>€|eur|chf|usd|\$)\s*(?P<amount_prefix>(?:\d{1,3}(?:[ .]\d{3})+|\d{2,4})(?:[,.]\d{1,2})?))",
    re.IGNORECASE,
)


def extract_starttime_values(text, limit=4):
    """Return only clock times found in explicit start-time contexts."""
    found = []
    for context in CANDIDATE_PATTERNS["starttime"].finditer(text or ""):
        for match in TIME_VALUE_PATTERN.finditer(context.group(0)):
            value = f"{int(match.group(1)):02d}:{match.group(2)}"
            if value not in found:
                found.append(value)
            if len(found) >= limit:
                return found
    return found


def extract_race_cost_values(text, limit=4):
    """Return only currency amounts found in explicit entry-fee contexts."""
    found = []
    for context in CANDIDATE_PATTERNS["raceCost"].finditer(text or ""):
        matches = list(MONEY_VALUE_PATTERN.finditer(context.group(0)))
        if not matches:
            continue
        match = matches[-1]
        amount = match.group("amount") or match.group("amount_prefix")
        currency = match.group("currency") or match.group("currency_prefix")
        currency = {"eur": "€", "usd": "USD", "$": "USD", "chf": "CHF"}.get(currency.lower(), currency)
        value = f"{amount} {currency}"
        if value not in found:
            found.append(value)
        if len(found) >= limit:
            break
    return found
