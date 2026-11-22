#!/usr/bin/env python3
"""Find evidence-backed missing route data. Never edits EVENTS; emits owner-review proposals."""
import json, math, os, re, urllib.request, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.parse import urljoin, urlparse
from event_data_rules import extract_cutoff_hours, filter_shared_gpx_proposals, is_http_url, meaningful_elevation_gain
from event_data_candidates import CANDIDATE_PATTERNS, extract_contexts, extract_date_values, extract_starttime_values, extract_race_cost_values, missing_candidate_fields, extract_profile_candidates, extract_timechart_candidates

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
    root=ET.fromstring(data)
    # Keep each GPX track segment / route separate. Flattening all points can
    # invent distance between unrelated tracks, and dropping missing elevation
    # points can invent ascent across gaps in the elevation series.
    containers=[]
    for node in root.iter():
        kind=node.tag.split("}")[-1]
        if kind=="trkseg":
            containers.append((node,"trkpt"))
        elif kind=="rte":
            containers.append((node,"rtept"))
    if not containers:
        containers=[(root,"trkpt"),(root,"rtept")]
    segments=[]
    for parent,point_tag in containers:
        pts=[]
        for p in parent:
            if p.tag.split("}")[-1]!=point_tag:
                continue
            try:
                lat=float(p.attrib["lat"]); lon=float(p.attrib["lon"])
                if not (math.isfinite(lat) and math.isfinite(lon) and -90<=lat<=90 and -180<=lon<=180):
                    continue
                ele=next((float(ch.text) for ch in p if ch.tag.split("}")[-1]=="ele" and ch.text),None)
                if ele is not None and not math.isfinite(ele):
                    ele=None
                pts.append((lat,lon,ele))
            except (KeyError,ValueError,TypeError):
                continue
        if pts:
            segments.append(pts)
    point_count=sum(len(segment) for segment in segments)
    if point_count<2:
        return None
    distance=sum(haversine(a[:2],b[:2]) for segment in segments for a,b in zip(segment,segment[1:]))/1000
    ascent=0.0
    elevation_pairs=0
    for segment in segments:
        for a,b in zip(segment,segment[1:]):
            if a[2] is not None and b[2] is not None:
                ascent+=max(0,b[2]-a[2])
                elevation_pairs+=1
    elevations=[p[2] for segment in segments for p in segment if p[2] is not None]
    gain=meaningful_elevation_gain(elevations,ascent) if elevation_pairs else None
    return {"km":round(distance,2),"hm":gain,"trackPoints":point_count,"hasElevation":gain is not None}
def route_scan(event, ri, route):
    props=[]
    # The direct GPX URL was previously ignored: only embedded webpage links were scanned.
    direct_gpx=route.get("gpxDownloadUrl")
    if isinstance(direct_gpx,str) and GPX_RE.search(direct_gpx) and urlparse(direct_gpx).scheme in ("http","https"):
        try:
            data, actual, typ=fetch(direct_gpx,8_000_000)
            if b"<gpx" in data[:1000].lower():
                metrics=parse_gpx(data)
                if metrics:
                    old_km=route.get("km")
                    try: distance_ratio=abs(float(metrics["km"])-float(old_km))/float(old_km) if old_km not in (None,"",0) else 0
                    except (TypeError,ValueError): distance_ratio=0
                    warnings=[]
                    if distance_ratio>0.5:
                        warnings.append("WARNUNG: GPX-Länge weicht um mehr als 50 Prozent vom gespeicherten Streckenwert ab; möglicherweise falscher oder unvollständiger Track.")
                    if metrics.get("hm") is None and route.get("hm") not in (None,""):
                        warnings.append("GPX enthält keine belastbaren Höhenwerte; vorhandene Höhenmeter nicht durch diesen Track ersetzen.")
                    evidence="Direkt hinterlegte öffentliche GPX-Datei; Werte lokal aus Trackpunkten berechnet."
                    if warnings: evidence += " " + " ".join(warnings)
                    props.append({"proposal_type":"data_correction","title":f"GPX-Daten prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}",
                      "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id") or ""),"eventName":event.get("name"),"routeId":str(route.get("id") or ri),"routeIndex":ri,
                        "field":"gpxMetrics","oldValue":{"km":route.get("km"),"hm":route.get("hm")},"newValue":metrics,"sourceUrl":actual,
                        "evidence":evidence,"reviewWarning":warnings or None,
                        "checkedAt":NOW,"requiresOwnerApproval":True}})
        except Exception:
            pass
    # A generic event homepage may describe several distances. Do not attach
    # its GPX links or cut-off text to one arbitrary route. Use an explicitly
    # route-linked page, or the event homepage only when the event has one route.
    route_sources=[route.get("web"),route.get("profileUrl"),route.get("cutoffUrl")]
    source=next((u for u in route_sources if is_http_url(u) and u != event.get("web")),None)
    # A single-route event may safely use its official event page as evidence.
    # Prefer the explicit GPX source page; gpxDownloadUrl can be a file URL.
    if source is None and len(event.get("routes",[]))==1:
        fallback_sources=[route.get("gpxSource"),event.get("web"),route.get("gpxDownloadUrl")]
        source=next((u for u in fallback_sources if is_http_url(u) and not GPX_RE.search(u)),None)
    if not is_http_url(source): return props
    try: raw, final_url, ctype=fetch(source)
    except Exception as e: return props
    page=raw.decode("utf-8","replace")
    title=re.sub(r"<[^>]+>"," ",page[:5000])
    plain=unescape(re.sub(r"<script\b.*?</script>|<style\b.*?</style>"," ",page,flags=re.I|re.S))
    plain=re.sub(r"<[^>]+>"," ",plain); plain=re.sub(r"\s+"," ",plain)
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
            old_km=route.get("km")
            try: distance_ratio=abs(float(metrics["km"])-float(old_km))/float(old_km) if old_km not in (None,"",0) else 0
            except (TypeError,ValueError): distance_ratio=0
            warnings=[]
            if distance_ratio>0.5:
                warnings.append("WARNUNG: GPX-Länge weicht um mehr als 50 Prozent vom gespeicherten Streckenwert ab; möglicherweise falscher oder unvollständiger Track.")
            if metrics.get("hm") is None and route.get("hm") not in (None,""):
                warnings.append("GPX enthält keine belastbaren Höhenwerte; vorhandene Höhenmeter nicht durch diesen Track ersetzen.")
            evidence="Öffentlich erreichbare GPX-Datei von der verknüpften Strecken-/Veranstalterseite; Werte lokal aus Trackpunkten berechnet."
            if warnings: evidence += " " + " ".join(warnings)
            props.append({"proposal_type":"data_correction","title":f"GPX-Daten prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}",
              "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id") or ""),"eventName":event.get("name"),"routeId":str(route.get("id") or ri),"routeIndex":ri,
                "field":"gpxMetrics","oldValue":{"km":route.get("km"),"hm":route.get("hm")},"newValue":metrics,"sourceUrl":actual,
                "evidence":evidence,"reviewWarning":warnings or None,
                "checkedAt":NOW,"requiresOwnerApproval":True}})
            break
        except Exception: continue
    # Extract only explicit time-limit phrases. Existing values are compared too,
    # so clear official corrections become review proposals rather than being ignored.
    cutoff_hours=extract_cutoff_hours(plain)
    if cutoff_hours is not None and not route.get("cutoffs"):
        try: current_hours=float(route.get("maxh")) if route.get("maxh") not in (None,"") else None
        except (TypeError,ValueError): current_hours=None
        if current_hours is None or abs(current_hours-cutoff_hours)>0.01:
            props.append({"proposal_type":"data_correction","title":f"Zeitlimit prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}",
              "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id") or ""),"eventName":event.get("name"),"routeId":str(route.get("id") or ri),"routeIndex":ri,
                "field":"maxh","oldValue":current_hours,"newValue":cutoff_hours,"sourceUrl":final_url,
                "evidence":"Explizite Zeitlimit-Angabe auf der zugeordneten Veranstalter-/Streckenseite erkannt. Wert und Streckenzuordnung vor Übernahme manuell prüfen.",
                "checkedAt":NOW,"requiresOwnerApproval":True}})
    # Profile and time-chart findings remain review leads, never imported values.
    if not (route.get("elevationProfile") or route.get("profilePoints") or route.get("profileData")):
        profile_candidates = extract_profile_candidates(page)
        if profile_candidates:
            props.append({"proposal_type":"data_correction",
              "title":f"Höhenprofil-Quelle prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}",
              "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id")),"eventName":event.get("name"),
                "routeId":str(route.get("id") or ri),"routeIndex":ri,"field":"profileCandidate","oldValue":None,
                "newValue":profile_candidates,"sourceUrl":final_url,
                "evidence":"Nur Hinweis auf eine ausdrücklich als Höhenprofil gekennzeichnete SVG-Grafik. Keine Koordinaten oder Höhenwerte extrahiert; Achsen und Streckenzuordnung manuell prüfen.",
                "checkedAt":NOW,"requiresOwnerApproval":True}})
    if not (route.get("timeChart") or route.get("timeChartData") or route.get("checkpoints")):
        time_candidates = extract_timechart_candidates(plain)
        if time_candidates:
            props.append({"proposal_type":"data_correction",
              "title":f"Zeitplan/Kontrollstellen prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}",
              "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id")),"eventName":event.get("name"),
                "routeId":str(route.get("id") or ri),"routeIndex":ri,"field":"timeChartCandidate","oldValue":None,
                "newValue":time_candidates,"sourceUrl":final_url,
                "evidence":"Textfragmente mit explizitem Zeitplan-/Kontrollstellenbezug. Zeiten, km-Zuordnung und Streckenzugehörigkeit manuell verifizieren.",
                "checkedAt":NOW,"requiresOwnerApproval":True}})
    # Raw official-page snippets only: date, start time and entry fee need manual verification.
    for field, missing in missing_candidate_fields(route).items():
        if not missing:
            continue
        if field == "date":
            values = extract_date_values(plain)
            if not values:
                continue
            # Keep date values machine-readable and short. Store surrounding
            # page text only as evidence, never as the proposed field value.
            contexts = extract_contexts(plain, CANDIDATE_PATTERNS[field])
            evidence = "Exakte Datumszeichenfolge(n): " + ", ".join(values) + ". Kontext: " + " | ".join(contexts[:2])
            new_value = values
            title = f"Datumsfund prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}"
        elif field == "starttime":
            values = extract_starttime_values(plain)
            if not values:
                continue
            evidence = "Nur erkannte Uhrzeit(en) aus einer expliziten Startzeit-Angabe. Streckenzuordnung und Gültigkeit manuell prüfen."
            new_value = values
            title = f"Startzeit prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}"
        elif field == "raceCost":
            values = extract_race_cost_values(plain)
            if not values:
                continue
            evidence = "Nur erkannte Geldbeträge aus einer expliziten Startgeld-/Nenngeld-Angabe. Währung, Preisstaffel und Gültigkeit manuell prüfen."
            new_value = values
            title = f"Startgeld prüfen: {event.get('name')} · {route.get('name') or route.get('route') or ri}"
        props.append({"proposal_type":"data_correction",
          "title":title,
          "payload":{"source":"automated_event_data_finder","eventId":str(event.get("id") or ""),"eventName":event.get("name"),
            "routeId":str(route.get("id") or ri),"routeIndex":ri,"field":field+"Candidate","oldValue":route.get(field),"newValue":new_value,"sourceUrl":final_url,
            "evidence":evidence,
            "checkedAt":NOW,"requiresOwnerApproval":True}})
    return props

proposals=[]
jobs=[]
for event in events:
    for i,route in enumerate(event.get("routes",[])):
        # Focus only routes with at least one missing data field of interest.
        if (route.get("km") and route.get("hm") and route.get("maxh") and route.get("gpxDownloadUrl") and (route.get("elevationProfile") or route.get("profilePoints")) and route.get("date") and route.get("starttime") and route.get("raceCost") not in (None, "")): continue
        jobs.append((event,i,route))
with ThreadPoolExecutor(max_workers=10) as pool:
    futures=[pool.submit(route_scan,*job) for job in jobs]
    for f in as_completed(futures):
        try: proposals.extend(f.result())
        except Exception: pass
# Do not attribute one identical GPX file to several routes of the same event.
proposal_count_before_shared_filter = len(proposals)
# Include every route that references a direct GPX URL, even if that route
# is already complete and therefore omitted from the scan jobs.
known_routes_by_source = {}
for event in events:
    for route_index, route in enumerate(event.get("routes", [])):
        source_url = route.get("gpxDownloadUrl")
        if isinstance(source_url, str) and GPX_RE.search(source_url) and urlparse(source_url).scheme in ("http", "https"):
            route_id = route.get("id") or route_index
            known_routes_by_source.setdefault((event.get("id"), source_url), []).append(
                {"routeId": route_id, "km": route.get("km")}
            )
proposals = filter_shared_gpx_proposals(proposals, known_routes_by_source=known_routes_by_source)
skipped_shared_gpx_proposals = proposal_count_before_shared_filter - len(proposals)
# Deduplicate stable field/source candidates to avoid flooding review queue.
unique={}
for p in proposals:
    x=p["payload"]; key=(x.get("eventId"),x.get("routeId"),x.get("field"),x.get("sourceUrl"))
    unique[key]=p
out={"generatedAt":NOW,"scannedRoutes":len(jobs),"proposalCount":len(unique),"skippedSharedGpxProposals":skipped_shared_gpx_proposals,"proposals":list(unique.values())}
(ROOT/"event-data-proposals.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in out.items() if k!="proposals"},ensure_ascii=False))
