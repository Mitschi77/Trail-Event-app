#!/usr/bin/env python3
"""Find evidence-backed missing route data. Never edits EVENTS; emits owner-review proposals."""
import json, math, os, re, urllib.request, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
m = re.search(r"const EVENTS=", HTML)
if not m: raise SystemExit("EVENTS array not found")
events, _ = json.JSONDecoder().raw_decode(HTML[m.end():])
NOW = datetime.now(timezone.utc).isoformat()
HEADERS = {"User-Agent":"Mozilla/5.0 (compatible; TrailEventDataFinder/1.0; +https://github.com/Mitschi77/Trail-Event-app)"}
GPX_RE = re.compile(r"\.gpx(?:[?#]|$)", re.I)
CUTOFF_RE = re.compile(r"(?i)(?:cut[\s-]?off|time\s*limit|zeitlimit|max(?:imum)?\s*time|maximalzeit|schlusszeit|zeitbeschränkung)[^.!?\n]{0,100}?(?:\d{1,2}(?:[.,:]\d{1,2})?\s*(?:h|hours?|stunden?)|\d{1,2}:\d{2})")
def fetch(url, limit=2_000_000):
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=18) as r: return r.read(limit), r.geturl(), r.headers.get("Content-Type","")
def haversine(a,b):
    r=6371000; p1,p2=math.radians(a[0]),math.radians(b[0]); dp=math.radians(b[0]-a[0]); dl=math.radians(b[1]-a[1])
    return 2*r*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
def parse_gpx(data):
    root=ET.fromstring(data); pts=[]
    for p in root.iter():
        if p.tag.split("}")[-1] in ("trkpt","rtept"):
            try:
                lat=float(p.attrib["lat"]); lon=float(p.attrib["lon"])
                ele=next((float(c.text) for c in p if c.tag.split("}")[-1]=="ele" and c.text),None)
                pts.append((lat,lon,ele))
            except (KeyError,ValueError,TypeError): pass
    if len(pts)<2: return None
    distance=sum(haversine(a[:2],b[:2]) for a,b in zip(pts,pts[1:]))/1000
    elevations=[p[2] for p in pts if p[2] is not None]
    gain=sum(max(0,b-a) for a,b in zip(elevations,elevations[1:])) if len(elevations)>1 else None
    return {"km":round(distance,2),"hm":round(gain) if gain is not None else None,"trackPoints":len(pts),"hasElevation":gain is not None}
def route_scan(event, ri, route):
    source=route.get("web") or route.get("profileUrl") or route.get("cutoffUrl") or event.get("web")
    if not isinstance(source,str) or urlparse(source).scheme not in ("http","https"): return []
    try: raw, final_url, ctype=fetch(source)
    except Exception as e: return []
    page=raw.decode("utf-8","replace")
    title=re.sub(r"<[^>]+>"," ",page[:5000])
    plain=unescape(re.sub(r"<script\b.*?</script>|<style\b.*?</style>"," ",page,flags=re.I|re.S))
    plain=re.sub(r"<[^>]+>"," ",plain); plain=re.sub(r"\s+"," ",plain)
    props=[]
    links=[]
    for href in re.findall(r"""(?:href|src)\s*=\s*["']([^"']+)["']""",page,re.I):
        absolute=urljoin(final_url,unescape(href))
        if GPX_RE.search(absolute) and urlparse(absolute).scheme in ("http","https"): links.append(absolute)
    links=list(dict.fromkeys(links))[:8]
    # Download only direct, public GPX candidates; parse metrics locally. Never mirror files.
    for link in links:
        try:
            data, actual, typ=fetch(link,8_000_000)
            if b"<gpx" not in data[:1000].lower(): continue
            metrics=parse_gpx(data)
            if not metrics: continue
            props.append({"proposal_type":"data_correction","title":f"GPX-Daten prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}",
              "payload":{"source":"automated_event_data_finder","eventId":event.get("id"),"eventName":event.get("name"),"routeId":route.get("id"),"routeIndex":ri,
                "field":"gpxMetrics","oldValue":{"km":route.get("km"),"hm":route.get("hm")},"newValue":metrics,"sourceUrl":actual,
                "evidence":"Öffentlich erreichbare GPX-Datei von der verknüpften Strecken-/Veranstalterseite; Werte lokal aus Trackpunkten berechnet.",
                "checkedAt":NOW,"requiresOwnerApproval":True}})
            break
        except Exception: continue
    # Cut-off text is only a candidate; context and URL are retained for human verification.
    if not route.get("maxh") and not route.get("cutoffs"):
        hits=CUTOFF_RE.findall(plain)
        if hits:
            props.append({"proposal_type":"data_correction","title":f"Cut-off prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}",
              "payload":{"source":"automated_event_data_finder","eventId":event.get("id"),"eventName":event.get("name"),"routeId":route.get("id"),"routeIndex":ri,
                "field":"cutoffCandidate","oldValue":None,"newValue":hits[:5],"sourceUrl":final_url,
                "evidence":"Texttreffer auf der hinterlegten Veranstalter-/Streckenseite. Kein automatischer Zahlenimport; Zuordnung und Bedeutung manuell prüfen.",
                "checkedAt":NOW,"requiresOwnerApproval":True}})
    # Candidate extraction for missing route date, start time and entry fee.
    # Keep the original text fragment as evidence; never normalize or auto-apply it.
    def contexts(pattern, limit=4):
        found=[]
        for match in re.finditer(pattern, plain, re.I):
            left=max(0,match.start()-100); right=min(len(plain),match.end()+140)
            snippet=plain[left:right].strip()
            if snippet and snippet not in found: found.append(snippet)
            if len(found)>=limit: break
        return found
    candidate_fields = [
        ("date", not route.get("date"), r"\b(?:\d{1,2}[./]\d{1,2}[./](?:20)?\d{2}|\d{1,2}\.\s*(?:jan(?:uar)?|feb(?:ruar)?|märz|mar(?:ch)?|apr(?:il)?|mai|may|jun(?:i|e)?|jul(?:i|y)?|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)(?:\s+20\d{2})?)\b"),
        ("starttime", not route.get("starttime"), r"\b(?:startzeit|start time|startschuss|wave start|mass start|start)\b[^.!?]{0,100}\b\d{1,2}[:.]\d{2}\s*(?:uhr|am|pm)?"),
        ("raceCost", route.get("raceCost") in (None, "", 0), r"\b(?:startgeld|nenngeld|teilnahmegebühr|entry fee|registration fee|race fee|registration|early bird)\b[^.!?]{0,120}(?:\d{2,4}(?:[.,]\d{1,2})?\s?(?:€|eur|chf|usd|\$)|(?:€|eur|chf|usd|\$)\s?\d{2,4}(?:[.,]\d{1,2})?)")
    ]
    for field, missing, pattern in candidate_fields:
        if not missing: continue
        snippets=contexts(pattern)
        if not snippets: continue
        props.append({"proposal_type":"data_correction",
          "title":f"{field}-Angabe prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}",
          "payload":{"source":"automated_event_data_finder","eventId":event.get("id"),"eventName":event.get("name"),
            "routeId":route.get("id"),"routeIndex":ri,"field":field+"Candidate","oldValue":route.get(field),
            "newValue":snippets,"sourceUrl":final_url,
            "evidence":"Textkandidat von der hinterlegten Veranstalter-/Streckenseite. Originalkontext bleibt erhalten; Jahr, Strecke, Preisstaffel und Gültigkeit müssen manuell geprüft werden.",
            "checkedAt":NOW,"requiresOwnerApproval":True}})
    return props

proposals=[]
jobs=[]
for event in events:
    for i,route in enumerate(event.get("routes",[])):
        # Focus only routes with at least one missing data field of interest.
        if (route.get("km") and route.get("hm") and route.get("maxh") and route.get("gpxDownloadUrl")
            and (route.get("elevationProfile") or route.get("profilePoints"))
            and route.get("date") and route.get("starttime") and route.get("raceCost") not in (None, "", 0)):
            continue
        jobs.append((event,i,route))
with ThreadPoolExecutor(max_workers=10) as pool:
    futures=[pool.submit(route_scan,*job) for job in jobs]
    for f in as_completed(futures):
        try: proposals.extend(f.result())
        except Exception: pass
# Deduplicate stable field/source candidates to avoid flooding review queue.
unique={}
for p in proposals:
    x=p["payload"]; key=(x.get("eventId"),x.get("routeId"),x.get("field"),x.get("sourceUrl"))
    unique[key]=p
out={"generatedAt":NOW,"scannedRoutes":len(jobs),"proposalCount":len(unique),"proposals":list(unique.values())}
(ROOT/"event-data-proposals.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in out.items() if k!="proposals"},ensure_ascii=False))
