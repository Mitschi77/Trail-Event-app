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
    candidates=[route.get("profileUrl"),route.get("cutoffUrl"),route.get("gpxSource"),route.get("gpxDownloadUrl"),route.get("web"),event.get("web")]
    source=next((u for u in candidates if isinstance(u,str) and urlparse(u).scheme in ("http","https")),None)
    if not source: return []
    try: raw, final_url, ctype=fetch(source)
    except Exception as e: return []
    page=raw.decode("utf-8","replace")
    title=re.sub(r"<[^>]+>"," ",page[:5000])
    plain=unescape(re.sub(r"<script\b.*?</script>|<style\b.*?</style>"," ",page,flags=re.I|re.S))
    plain=re.sub(r"<[^>]+>"," ",plain); plain=re.sub(r"\s+"," ",plain)
    props=[]
    route_id=str(route.get("id") or ri)
    route_label=route.get("name") or route.get("route") or f"Strecke {ri+1}"
    # Profile: collect compact, source-grounded SVG/chart traces embedded in the official page.
    # These remain review candidates; the finder never writes route fields directly.
    if not (route.get("elevationProfile") or route.get("profilePoints")):
        profile=[]
        for svg in re.findall(r"<svg\b[^>]*>.*?</svg>",page,flags=re.I|re.S):
            if not re.search(r"(?i)elev|profile|altitude|height|höhen",svg): continue
            for pts in re.findall(r"""points\s*=\s*["']([^"']{1,12000})["']""",svg,re.I)[:3]:
                nums=re.findall(r"-?\d+(?:\.\d+)?",pts)
                if len(nums)>=4: profile.append({"type":"svg_points","values":[float(x) for x in nums[:400]]})
            for d in re.findall(r"""\bd\s*=\s*["']([^"']{1,12000})["']""",svg,re.I)[:2]:
                if re.search(r"[MLCQ]",d) and len(d)>40: profile.append({"type":"svg_path","path":d[:6000]})
        if profile:
            props.append({"proposal_type":"data_correction","title":f"Höhenprofil prüfen: {event.get('name')} · {route_label}",
              "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id")),"eventName":event.get("name"),"routeId":route_id,"routeIndex":ri,
                "field":"profileData","oldValue":None,"newValue":profile[:5],"sourceUrl":final_url,
                "evidence":"Eingebettete SVG-Kurven/Koordinaten von der verknüpften Streckenseite. Achsenskalierung und Distanzzuordnung manuell prüfen.",
                "checkedAt":NOW,"requiresOwnerApproval":True}})
    # Time charts / checkpoints: capture short contextual text fragments, not inferred times.
    if not (route.get("cutoffs") or route.get("timeChart") or route.get("checkpoints")):
        fragments=[]
        patterns=[r"(?i)(?:time\s*chart|cut[\s-]?off|checkpoint|aid\s*station|verpflegung|kontrollstelle|zeitlimit)[^.!?]{0,180}",
                  r"(?i)(?:\d{1,3}(?:[.,]\d+)?\s*km)[^.!?]{0,100}(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:h|hours?))"]
        for pat in patterns:
            fragments.extend(re.findall(pat,plain)[:10])
        fragments=list(dict.fromkeys(x.strip() for x in fragments if len(x.strip())>12))[:12]
        if fragments:
            props.append({"proposal_type":"data_correction","title":f"Zeitplan/Kontrollstellen prüfen: {event.get('name')} · {route_label}",
              "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id")),"eventName":event.get("name"),"routeId":route_id,"routeIndex":ri,
                "field":"timeChartData","oldValue":None,"newValue":fragments,"sourceUrl":final_url,
                "evidence":"Textfragmente mit Kontrollstellen-/Zeitplanbezug von der verknüpften Seite. Reihenfolge, km-Zuordnung und Cut-offs manuell verifizieren.",
                "checkedAt":NOW,"requiresOwnerApproval":True}})
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
              "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id")),"eventName":event.get("name"),"routeId":route_id,"routeIndex":ri,
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
              "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id")),"eventName":event.get("name"),"routeId":route_id,"routeIndex":ri,
                "field":"cutoffCandidate","oldValue":None,"newValue":hits[:5],"sourceUrl":final_url,
                "evidence":"Texttreffer auf der hinterlegten Veranstalter-/Streckenseite. Kein automatischer Zahlenimport; Zuordnung und Bedeutung manuell prüfen.",
                "checkedAt":NOW,"requiresOwnerApproval":True}})
    return props

proposals=[]
jobs=[]
for event in events:
    for i,route in enumerate(event.get("routes",[])):
        # Focus only routes with at least one missing data field of interest.
        if route.get("km") and route.get("hm") and route.get("maxh") and route.get("gpxDownloadUrl") and (route.get("elevationProfile") or route.get("profilePoints")): continue
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
