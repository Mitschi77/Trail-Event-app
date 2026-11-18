import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const raceTools = await readFile(new URL("../race-tools.js", import.meta.url), "utf8");
const seasonTools = await readFile(new URL("../season-tools.js", import.meta.url), "utf8");
const eventDataMatch = html.match(/const EVENTS=(\[[\s\S]*?\]);?\s*function enrichUtmbRouteCategories/);
assert.ok(eventDataMatch, "Event data must remain parseable");
const appEvents = JSON.parse(eventDataMatch[1]);
const appRoutes = appEvents.flatMap(event => event.routes || []);
const routeById = id => appRoutes.find(route => route.id === id);
const serializedRecordById = id => {
  const index = html.indexOf('"id":"' + id + '"');
  if (index < 0) return "";
  const start = html.lastIndexOf("{", index);
  const end = html.indexOf("}", index);
  return start >= 0 && end > start ? html.slice(start, end + 1) : "";
};


assert.ok(serviceWorker.includes("'./event-dates.json'"), "Offline app shell must cache the official event feed");
assert.ok(serviceWorker.includes("trail-event-planner-v53"), "App shell cache must be versioned for the aid-station parser update");
assert.ok(serviceWorker.includes("url.pathname.endsWith('/event-dates.json')"), "Official event feed must use a network-first cache strategy");
assert.ok(serviceWorker.includes("cache.put(cacheKey, copy)") && serviceWorker.includes("caches.match(cacheKey)"), "Official event feed must remain available offline without retaining timestamp query variants");

assert.ok(html.includes("'trailRacePriorities'"), "Season priorities must be included in private backups and cloud snapshots");
assert.equal(routeById("mozart-100-84-4800")?.raceCost, "208,20 € (Startgeld inkl. 20 % USt.; ohne Zusatzleistungen und Servicegebühren)", "Mozart 2027 entry fee must match the UTMB payment receipt");
assert.equal(routeById("mozart-100-84-4800")?.paidCost, "248,18 €", "Mozart 2027 paid total must match the UTMB payment receipt");
assert.equal(routeById("mozart-100-84-4800")?.paidCostDate, "2026-07-15", "Mozart payment date must remain recorded");
assert.equal(routeById("mozart-100-84-4800")?.paidCostStatus, "Bezahlt", "Mozart paid status must remain recorded");
assert.equal(routeById("3kings-3hills-54-2300")?.raceCost, "79,00 €", "3Kings 2027 entry fee must match the paid invoice");
assert.equal(routeById("3kings-3hills-54-2300")?.paidCost, "79,00 €", "3Kings 2027 paid total must match the paid invoice");
assert.equal(routeById("3kings-3hills-54-2300")?.paidCostDate, "2026-08-17", "3Kings payment date must remain recorded");
assert.equal(routeById("3kings-3hills-54-2300")?.paidCostStatus, "Bezahlt", "3Kings paid status must remain recorded");
assert.ok(html.includes("const storedStatus=runRecords[routeKey(id,ri)]?.raceStatus;const currentStatus=storedStatus||(r.paidCostStatus==='Bezahlt'?'paid':'planned')"), "A verified paid receipt must set the displayed default race status to paid without overriding a saved user status");
assert.ok(html.includes('"date":"2027-01-23","web":null,"starttime":null,"registration":null,"overnight":null,"hotelCost":null,"raceCost":"69,00 €","paidCost":"83,90 €","paidCostDate":"2026-09-17","paidCostStatus":"Bezahlt","paidCostDetails":"MOUNTAINMAN-Rechnung'), "MOUNTAINMAN 2027 date and paid total must match the invoice");
assert.ok(html.includes('"route":"mozart Ultra","km":84'), "2027 Mozart route must use the verified event name");
assert.ok(html.includes("Storage.prototype.removeItem=function(key)"), "Removing a planner data key must trigger cloud synchronization");
assert.ok(html.includes("Storage.prototype.clear=function()") && html.includes("hadPlannerData"), "Clearing local planner data must trigger cloud synchronization");

const cloudSignatureHelper = html.match(/function cloudSnapshotSignatures\(data\)\{[^\n]*\}/);
const cloudMergeHelper = html.match(/function mergeCloudSnapshots\(local,remote\)\{[^\n]*\}/);
assert.ok(cloudSignatureHelper && cloudMergeHelper, "Cloud snapshot merge helpers must remain testable");
const cloudSignature = new Function(cloudSignatureHelper[0] + "; return cloudSnapshotSignatures;")();
const mergeCloudSnapshots = new Function(
  "CLOUD_KEYS",
  "readCloudBaselineSignatures",
  cloudSignatureHelper[0] + cloudMergeHelper[0] + "; return mergeCloudSnapshots;"
);
const unchangedCloudData = { plannerTestKey: "previous value" };
const unchangedBaseline = cloudSignature(unchangedCloudData);
const deletionMerge = mergeCloudSnapshots(
  ["plannerTestKey"],
  () => unchangedBaseline
)({}, unchangedCloudData);
assert.deepEqual(deletionMerge.snapshot, {}, "A local deletion must be retained when the cloud copy is unchanged");
assert.equal(deletionMerge.remoteNeedsWrite, true, "A local deletion must be propagated to the cloud");
const concurrentEditMerge = mergeCloudSnapshots(
  ["plannerTestKey"],
  () => unchangedBaseline
)({}, { plannerTestKey: "changed remotely" });
assert.deepEqual(concurrentEditMerge.conflicts, ["plannerTestKey"], "A local deletion must not overwrite a concurrent remote edit");
assert.equal(routeById("110-tausend-111-4074")?.raceCost, "215,00 € (inkl. 25 % MwSt.)", "Istria 2027 published entry fee must remain recorded");
assert.equal(routeById("110-tausend-111-4074")?.paidCost, "296,44 €", "Istria 2027 paid receipt total must remain recorded");
assert.equal(routeById("110-tausend-111-4074")?.paidCostDate, "2026-07-05", "Istria 2027 payment date must remain recorded");
assert.equal(routeById("110-tausend-111-4074")?.paidCostStatus, "Bezahlt", "Istria 2027 paid status must remain recorded");
assert.equal(routeById("110-tausend-111-4074")?.paidCostDetails, "Startgeld 215,00 € inkl. MwSt.; Sportograf-Fotos 33,52 €; Bus-Transfer 18,75 € inkl. MwSt.; Servicegebühren inkl. Steuer 29,17 €", "Istria 2027 receipt breakdown must remain recorded");
assert.equal(routeById("tmcdc-185-3500")?.raceCost, "177–213 € (Startgeld laut Veranstalter, abhängig von Anmeldephase; Bearbeitungsgebühren ggf. zusätzlich)", "tmcdc-185-3500 published entry fee must remain recorded");
assert.equal(routeById("tmcn-100-2300")?.raceCost, "127–153 € (Startgeld laut Veranstalter, abhängig von Anmeldephase; Bearbeitungsgebühren ggf. zusätzlich)", "tmcn-100-2300 published entry fee must remain recorded");
assert.equal(routeById("tmcs-85-1200")?.raceCost, "117–143 € (Startgeld laut Veranstalter, abhängig von Anmeldephase; Bearbeitungsgebühren ggf. zusätzlich)", "tmcs-85-1200 published entry fee must remain recorded");
assert.equal(routeById("ptcn-58-1200")?.raceCost, "75–98 € (Startgeld laut Veranstalter, abhängig von Anmeldephase; Bearbeitungsgebühren ggf. zusätzlich)", "ptcn-58-1200 published entry fee must remain recorded");
assert.equal(routeById("ugp-125-5700")?.raceCost, "240–270 € (100M-Tarif laut UTMB; zzgl. 8 % Verwaltungsgebühr)", "ugp-125-5700 published entry fee must remain recorded");
assert.equal(routeById("ugp-87-4200")?.raceCost, "169–199 € (100K-Tarif laut UTMB; zzgl. 8 % Verwaltungsgebühr)", "ugp-87-4200 published entry fee must remain recorded");
assert.equal(routeById("ugp-51-2500")?.raceCost, "95 € (50K-Tarif laut UTMB; zzgl. 8 % Verwaltungsgebühr)", "ugp-51-2500 published entry fee must remain recorded");
assert.equal(routeById("ultra-trail-des-chevaliers-156-5100")?.raceCost, "275–305 € (UTDC 100M, dynamischer Tarif laut UTMB)", "ultra-trail-des-chevaliers-156-5100 published entry fee must remain recorded");
assert.equal(routeById("trail-des-celtes-47-1600")?.raceCost, "140–170 € (TDC 50K, dynamischer Tarif laut UTMB; 5 % FFA-Rabatt möglich)", "trail-des-celtes-47-1600 published entry fee must remain recorded");
assert.equal(routeById("ultra-105k-105-6800")?.raceCost, "315,10 € (aktueller UTMB-Tarif 2027; inklusive Bearbeitungsgebühr und MwSt.)", "ultra-105k-105-6800 published entry fee must remain recorded");
assert.equal(routeById("120k-120-5800")?.raceCost, "320,31 €", "120k-120-5800 published entry fee must remain recorded");
assert.equal(routeById("80k-80-4600")?.raceCost, "224,49 €", "80k-80-4600 published entry fee must remain recorded");
assert.equal(routeById("50k-50-2800")?.raceCost, "173,84 €", "50k-50-2800 published entry fee must remain recorded");
assert.equal(routeById("lavaredo-20k-20-1000")?.raceCost, "83,50 €", "lavaredo-20k-20-1000 published entry fee must remain recorded");
assert.ok(serializedRecordById("lavaredo-10k-10-300").includes('"raceCost":"39,70 €"'), "lavaredo-10k-10-300 published entry fee must remain recorded");
assert.ok(html.includes("function collectLocalPlannerData(){const data={};CLOUD_KEYS.forEach"), "Backup and cloud snapshots must collect every registered local data key");
assert.ok(html.includes("function seasonSave()"), "Season priorities must have a dedicated persistence function");
assert.ok(raceTools.includes("function strategy(id,ri,r)"), "Per-race strategy planner must exist");
assert.ok(raceTools.includes("function save(id,ri,patch)"), "Race preparation values must be persisted");
assert.ok(raceTools.includes("function checklist(id,ri)"), "Per-race checklist must exist");
assert.ok(raceTools.includes("function training()"), "Recorded training history must be summarized");
assert.ok(raceTools.includes("function segmentUi(id,ri,r)"), "GPX segment planner must exist");
assert.ok(raceTools.includes("function segments(r,id,ri)"), "GPX elevation segments must be analyzed");

assert.ok(raceTools.includes("Verpflegungs-Erinnerungen"), "Race strategy must calculate fueling reminders");
assert.ok(raceTools.includes("angegebenen Maximalzeit"), "Race strategy must compare the estimate with the route cutoff");
assert.ok(raceTools.includes("raceCheckCount"), "Checklist must show completed-item progress");
assert.ok(raceTools.includes("groupDone"), "Checklist must show progress per category");
assert.ok(raceTools.includes("Saisonpriorität:"), "Race preparation must display the season priority");
assert.ok(raceTools.includes("Noch '+days+' Tage bis zum Start"), "Race preparation must show a countdown to the event");

assert.ok(html.includes('src="./race-tools.js"'), "Race preparation module must load");
assert.ok(html.includes('src="./season-tools.js"'), "Season training module must load");
assert.ok(seasonTools.includes("function load()"), "Weekly training load must use recorded activities");
assert.ok(seasonTools.includes("function panel()"), "Weekly training goal dashboard must exist");
assert.ok(seasonTools.includes("seasonPriorities[STORE]=next"), "Training goals must persist with season priorities");
assert.ok(seasonTools.includes("v.current.km") && seasonTools.includes("v.previous.km"), "Training load must compare current and previous weeks");
assert.ok(serviceWorker.includes("./season-tools.js") && /const CACHE_NAME = 'trail-event-planner-v\d+'/.test(serviceWorker), "Offline app shell must cache season tools and use a versioned cache");

assert.ok(html.includes("function localStorageBytes(replacementKey,replacementValue)"), "Local storage size guard must exist");
assert.ok(html.includes("async function refreshStorageHealth()"), "Storage usage and persistence status must be visible");
assert.ok(html.includes("async function requestPersistentStorage()"), "Users must be able to request persistent browser storage");
assert.ok(html.includes("async function compressRouteImage(file)"), "Uploaded route PNGs must be optimized before local storage");
assert.ok(html.includes("STORAGE_WARNING_BYTES"), "Route image writes must be guarded against localStorage quota exhaustion");
assert.ok(html.includes("if(file.size>8*1024*1024)"), "Route image uploads must have a safe source-file size limit");

assert.ok(html.includes("function renderOfficialQualitySummary()"), "Official event data quality dashboard must exist");
assert.ok(html.includes("window.officialEventFeed=feed"), "Official feed audit must use the loaded official event data");
assert.ok(html.includes("Maximalzeit/Cut-offs") && html.includes("Array.isArray(x.r.cutoffs)&&x.r.cutoffs.length"), "A verified cutoff list may satisfy the race time-limit completeness check");
assert.ok(html.includes("officialQualitySummary"), "Missing-data view must display a quality summary");


assert.match(html, /function parseTcxData\(xmlText\)/, "TCX parser must remain available for Garmin exports");
assert.ok(html.includes("async function parseActivityTrack(file)"), "Activity file parser must be async for FIT decoding");
assert.ok(html.includes("function validateActivityFileSize(file)"), "Activity file size validation must exist");
assert.ok(html.includes("?50*1024*1024:25*1024*1024"), "FIT files must allow up to 50 MB and GPX/TCX up to 25 MB");

assert.ok(html.includes("@garmin/fitsdk@21.221.0"), "FIT imports must use a pinned Garmin SDK version");
assert.ok(html.includes("result.messages?.recordMesgs"), "FIT parser must read Garmin recordMesgs");
assert.ok(html.includes("result.messages?.sessionMesgs"), "FIT parser must read Garmin sessionMesgs");
assert.ok(html.includes("Number(p.positionLat)*180/2147483648") && html.includes("Number(p.positionLong)*180/2147483648"), "FIT semicircle coordinates must be converted to degrees");

assert.ok(html.includes("manualIndex=runAttempts[key].findIndex"), "Activity imports must detect existing manual runs");
assert.ok(html.includes("Ergebnis, Platz und Bewertung bleiben erhalten."), "Activity import must preserve manual race metadata");
assert.ok(html.includes("sourceFile:file.name,sourceFileSize:file.size,sourceFileHash:fileHash,updatedAt:Date.now()"), "Merged activity imports must retain their duplicate-detection fingerprint");



assert.ok(html.includes('accept=".gpx,.tcx,.fit,'), "Import controls must accept FIT, GPX and TCX files");
assert.ok(html.includes("async function importActivityToHistory()"), "Activity history import must be available");
assert.ok(html.includes("Aktivität prüfen:"), "Activity import must show a preview before saving");
assert.ok(html.includes("distanceDelta>=.15"), "Activity import must flag material distance differences");
assert.ok(html.includes("Jetzt übernehmen?"), "Activity import preview must require confirmation");

assert.ok(html.includes("async function activityFileFingerprint(file)"), "Activity imports must fingerprint files for duplicate detection");
assert.ok(html.includes("sourceFileHash:fileHash"), "Imported activity records must persist their file fingerprint");
assert.ok(html.includes("const data=await parseActivityTrack(file),route=event.routes[ri]"), "Route file import must await async FIT/TCX parsing");
assert.ok(html.includes("async function importGpxForRoute(id,ri,input)"), "Planned route detail import must support asynchronous FIT/TCX parsing");
assert.ok(html.includes("const data=await parseActivityTrack(file);if(data.track.length<2)"), "Planned route detail import must await parsed track data");


assert.ok(html.includes("initActivityImport();"), "Activity import controls must initialize");
assert.ok(html.includes("durationSeconds"), "Imported activities must retain elapsed time");
const metricHelper = html.match(/function routeMetricLabel\(route,eventRef\)\{[^}]*\}/);
assert.ok(metricHelper, "Race type metric formatter must exist");
const routeMetricLabel = new Function("num", "routeMetricType", "routeTypeRequiresTrailMetrics", metricHelper[0] + "; return routeMetricLabel;")(
  value => String(value),
  value => value === "marathon" ? "Marathon" : value === "backyard" ? "Backyard" : "Trailrunning / Ultra",
  type => !["Marathon", "Halbmarathon", "Straßenlauf"].includes(type)
);
assert.equal(routeMetricLabel({ km: 42.2, hm: "", maxh: "" }, "marathon"), "42.2 km");
assert.equal(routeMetricLabel({ km: 50, hm: 2400, maxh: 12 }, "trail"), "50 km · 2400 hm · Max. Zeit 12 h");
assert.equal(routeMetricLabel({ km: 6.7, hm: 120, maxh: 24 }, "backyard"), "6.7 km · 120 hm");
const markupHelper = html.match(/function routeMetricMarkup\(route,eventRef\)\{[^}]*\}/);
assert.ok(markupHelper, "Race type metric markup must exist");
const routeMetricMarkup = new Function("num", "routeMetricType", "routeTypeRequiresTrailMetrics", markupHelper[0] + "; return routeMetricMarkup;")(
  value => String(value),
  value => value === "marathon" ? "Marathon" : value === "backyard" ? "Backyard" : "Trailrunning / Ultra",
  type => !["Marathon", "Halbmarathon", "Straßenlauf"].includes(type)
);
assert.equal(routeMetricMarkup({ km: 42.2, hm: "", maxh: "" }, "marathon"), "<span><b>42.2</b> km</span>");

assert.ok(html.includes("function routeDetailMetricKeys(type)"), "Event detail fields must respect the race type");
assert.ok(html.includes("if(!routeTypeRequiresTrailMetrics(type))return {event:[],route:[]}"), "Road races must omit trail-only event detail fields");
assert.ok(html.includes("if(type==='Backyard')return {event:['maxHm'],route:['hm']}"), "Backyard details must omit maximum time");
const trailMetricHelper = html.match(/function routeTypeRequiresTrailMetrics\(type\)\{[^}]*\}/);
assert.ok(trailMetricHelper, "Trail metric requirement helper must exist");
const routeTypeRequiresTrailMetrics = new Function(trailMetricHelper[0] + "; return routeTypeRequiresTrailMetrics;")();
assert.equal(routeTypeRequiresTrailMetrics("Marathon"), false);
assert.equal(routeTypeRequiresTrailMetrics("Halbmarathon"), false);
assert.equal(routeTypeRequiresTrailMetrics("Straßenlauf"), false);
assert.equal(routeTypeRequiresTrailMetrics("Trailrunning / Ultra"), true);

assert.ok(html.includes("routeTypeRequiresTrailMetrics(routeMetricType(x.id))&&(x.r.hm===null||x.r.hm===undefined||x.r.hm==='')"), "Season review must require elevation only for trail race types");


const calendarHelper = html.match(/function calendarEventDescription\(route,type\)\{[^}]*\}/);
assert.ok(calendarHelper, "Calendar export must format race-specific metrics");
const calendarEventDescription = new Function("routeTypeRequiresTrailMetrics", calendarHelper[0] + "; return calendarEventDescription;")(routeTypeRequiresTrailMetrics);
assert.equal(calendarEventDescription({ route: "Marathon", km: 42.2, hm: 300, maxh: 5 }, "Marathon"), "Marathon · 42.2 km");
assert.equal(calendarEventDescription({ route: "Halbmarathon", km: 21.1, hm: 100, maxh: 4 }, "Halbmarathon"), "Halbmarathon · 21.1 km");
assert.equal(calendarEventDescription({ route: "Backyard", km: 6.7, hm: 100, maxh: 24 }, "Backyard"), "Backyard · 6.7 km · 100 hm");
assert.equal(calendarEventDescription({ route: "Ultra", km: 50, hm: 2400, maxh: 12 }, "Trailrunning / Ultra"), "Ultra · 50 km · 2400 hm · Maximale Laufzeit: 12 h");
assert.ok((html.match(/routeTypeRequiresTrailMetrics\(routeMetricType\(x\.id\)\)\?\(Number\(x\.r\.hm\)\|\|0\):0/g)||[]).length>=2, "Road race elevation must not inflate planned elevation totals");




assert.ok(html.includes("avgHeartRate:data.avgHeartRate||0"), "Imported FIT activities must retain average heart rate");
assert.ok(html.includes("maxHeartRate:data.maxHeartRate||0"), "Imported FIT activities must retain maximum heart rate");
assert.ok(html.includes("calories:data.calories||0"), "Imported FIT activities must retain calories");
assert.ok(html.includes("Trainingsdaten:"), "Run history must display available imported training metrics");

assert.ok(html.includes("avgHeartRate:data.avgHeartRate||0"), "Imported FIT activities must retain average heart rate");
assert.ok(html.includes("maxHeartRate:data.maxHeartRate||0"), "Imported FIT activities must retain maximum heart rate");
assert.ok(html.includes("calories:data.calories||0"), "Imported FIT activities must retain calories");
assert.ok(html.includes("Trainingsdaten:"), "Run history must display available imported training metrics");

assert.ok(html.includes("function activityLocalDate(value)"), "Activity date conversion must be synchronous");
assert.ok(html.includes("const data=await parseActivityTrack(file)"), "Route imports must await asynchronous file parsing");
assert.ok(html.includes("eventValue!==''?EVENTS[Number(eventValue)]:null"), "Activity event selector must not silently choose the first event");
assert.ok(html.includes("function activityLocalDate(value)"), "Imported activity dates must use the device's local calendar");
assert.ok(html.includes("activityLocalDate(data.startTime)"), "Activity import must normalize timestamps to local dates");



assert.ok(html.includes('id="exportPlanCalendar"'), "Planner must offer calendar export");
assert.ok(html.includes('id="sortPlanChronologically"'), "Planner must expose chronological sorting");
assert.ok(html.includes("onclick=\"sortPlannedEventsChronologically()\""), "Chronological sort button must be wired");
const recoveryHelper = html.match(/const plannerRecoveryEnd=\(event,routeIndex\)=>\{[^}]*\};/);
assert.ok(recoveryHelper, "Multi-day recovery helper must be testable");
const plannerRecoveryEnd = new Function("plannerRouteDate", "eventEnd", "return (" + recoveryHelper[0].replace(/^const plannerRecoveryEnd=/, "").replace(/;$/, "") + ");")(
  (_event, _index) => new Date("2026-08-01T12:00:00Z"),
  () => new Date("2026-08-04T12:00:00Z")
);
assert.equal(plannerRecoveryEnd({}, 0).toISOString().slice(0, 10), "2026-08-04");

const seasonRecoveryHelper = html.match(/function seasonRecoveryDays\(e,r,record\)\{[\s\S]*?\nfunction seasonPhaseSegments/);
assert.ok(seasonRecoveryHelper, "Season recovery heuristic must be testable");
const seasonRecoveryDays = new Function(seasonRecoveryHelper[0].replace(/\nfunction seasonPhaseSegments[\s\S]*$/, "") + "; return seasonRecoveryDays;")();
assert.equal(seasonRecoveryDays({}, { km: 50, hm: 1500 }, { actualKm: "", actualHm: "", actualDurationHours: 8 }), 14);
assert.equal(seasonRecoveryDays({}, { km: 6.7, hm: 0 }, { raceStatus: "dnf" }), 7);
assert.equal(seasonRecoveryDays({}, { km: 100, hm: 3000 }, { actualDurationHours: 24 }), 21);
assert.ok(html.includes("esc(routeMetricLabel(x.r,x.id))"), "Season cards must respect race-specific metric display");
assert.ok(html.includes("seasonActualEnd(prev).getTime()+seasonRecoveryDays"), "Training timeline must begin recovery after the actual finish date or planned event end");
assert.ok(html.includes("grobe Planungsheuristik"), "Recovery estimate must be clearly described as a heuristic");

assert.ok(html.includes("const plannerRecoveryEnd=(event,routeIndex)=>"), "Multi-day races must expose a final-day recovery helper");
assert.ok(html.includes("end=last?plannerRecoveryEnd(last,lastRi):null"), "Next-race suggestions must start recovery after the selected or latest annual-plan event end");
assert.ok(html.includes("function latestYearPlanRace()"), "Planner must use the latest dated race from the annual plan as its default basis");
assert.ok(html.includes("eventSelect.dataset.manual==='1'"), "Planner must preserve an explicit manual event selection");
assert.ok(html.includes("(b.date-a.recoveryEnd)/86400000"), "Season check must compare next start to previous event end");
assert.ok(html.includes("selectedEnd&&nextDate&&nextDate<plusDays(selectedEnd,weeks*7)"), "Route selection must enforce recovery after multi-day events");
assert.ok(html.includes("inspectNewEventWebsite()"), "New race entry must support automatic website inspection");
assert.ok(html.includes("inspect-event-website"), "Website extraction must use the authenticated inspection function");
assert.ok(html.includes("Erkannte Angaben prüfen und ergänzen"), "Imported race data must remain manually reviewable and editable");
assert.ok(html.includes("setIfEmpty('newEventName',fields.name)"), "Website import must not overwrite manually entered event fields");
assert.ok(html.includes("function findPotentialDuplicateEvents(candidate)"), "New event proposals must be checked against the existing event database");
assert.ok(html.includes("Möglicher doppelter Eintrag"), "Review queue must visibly warn about possible duplicate races");
assert.ok(html.includes("duplicate_check:{checked_at:"), "Duplicate check results must be stored with the proposal for review");
assert.ok(html.includes("Trotzdem als neuen Prüfungsvorschlag einreichen?"), "Possible duplicates must be confirmed before submission");
assert.ok(html.includes("function exportPlannedCalendar()"), "Calendar export handler must exist");
assert.ok(html.includes("text/calendar;charset=utf-8"), "Calendar export must use the iCalendar MIME type");
assert.ok(html.includes("DTSTART;VALUE=DATE:"), "Calendar export must create all-day race events");
assert.ok(html.includes("lines.join('\\r\\n')+'\\r\\n'"), "Calendar file must use CRLF line endings");

assert.match(html, /function sortPlannedEventsChronologically\(\)/, "planner must provide chronological sorting");
assert.match(html, /items\.forEach\(\(\{e,r,date,id\}\)/, "calendar export must bind each event id");
assert.match(html, /eventLast&&eventLast>=date/, "calendar export must preserve multi-day event duration");

const match = html.match(/function completedRunDistance\(x\)\{[\s\S]*?\}/);
assert.ok(match, "completedRunDistance helper must exist");
const completedRunDistance = new Function("return (" + match[0] + ")")();

assert.ok(Math.abs(completedRunDistance({ r: { rounds: 3 }, route: { roundKm: 6.706, km: 6.706 }, ev: {} }) - 20.118) < 1e-9);
assert.equal(completedRunDistance({ r: { rounds: 2 }, route: { km: 8.4 }, ev: {} }), 16.8);
assert.equal(completedRunDistance({ r: { actualKm: 12.35, rounds: 3 }, route: { roundKm: 6.706, km: 6.706 }, ev: {} }), 12.35);
assert.equal(completedRunDistance({ r: {}, route: { km: 42.195 }, ev: {} }), 42.195);


const trackHelper = html.match(/function calculateTrackData\(raw\)\{[\s\S]*?\nfunction parseGpxData/);
assert.ok(trackHelper, "Shared GPX/TCX/FIT track calculator must exist");
const calculateTrackData = new Function(trackHelper[0].replace(/\nfunction parseGpxData[\s\S]*$/, "") + "; return calculateTrackData;")();
const track = calculateTrackData([
  { lat: 48, lon: 11, ele: 500, time: "2026-05-01T08:00:00Z" },
  { lat: 48.001, lon: 11, ele: 510, time: "2026-05-01T08:02:00Z" },
  { lat: 48.002, lon: 11, ele: 505, time: "2026-05-01T08:04:00Z" }
]);
assert.ok(track.distanceKm > 0.2 && track.distanceKm < 0.23, "Track distance must be calculated from GPS points");
assert.equal(track.ascentHm, 10);
assert.equal(track.descentHm, 5);
assert.equal(track.startTime, "2026-05-01T08:00:00.000Z");
assert.equal(track.durationSeconds, 240);

assert.ok(html.includes('id="exportPlanCalendar"'), "Planner must offer calendar export");
assert.ok(html.includes("function exportPlannedCalendar()"), "Calendar export handler must exist");
assert.ok(html.includes("text/calendar;charset=utf-8"), "Calendar export must use iCalendar MIME type");
assert.ok(html.includes("DTSTART;VALUE=DATE:"), "Calendar export must create all-day race events");
assert.ok(html.includes("lines.join('\\r\\n')+'\\r\\n'"), "Calendar file must use CRLF line endings");
assert.ok(html.includes("concat(plannedRepeatEntries.map(x=>"), "Season check must include repeated planned races");
assert.ok(html.includes("plannedRepeatEntries=[];savePlannerState();renderPlanner();"), "Reset must clear repeat entries as well as the main plan");


assert.ok(html.includes('id="seasonEnhancements"'), "Season steering panel must exist");
assert.ok(html.includes("function seasonRecoveryDays(e,r,record)"), "Recovery estimator must exist");
assert.ok(html.includes("function seasonPhaseSegments(gapDays,priority)"), "Training phase planner must exist");
assert.ok(html.includes("data-season-priority"), "Race priority selector must be wired");
assert.ok(html.includes("data-season-date"), "Actual race date must be editable");
assert.ok(html.includes("data-season-hours"), "Actual race duration must be editable");
assert.ok(html.includes("function seasonActualRecord(x)"), "Completed race attempts must feed actual recovery data");
const seasonRecoveryFunctionMatch = html.match(/function seasonRecoveryDays\(e,r,record\)\{[\s\S]*?\nfunction seasonPhaseSegments/);
assert.ok(seasonRecoveryFunctionMatch, "Recovery estimator must be isolated for regression tests");
const seasonRecoveryFunction = new Function(seasonRecoveryFunctionMatch[0].replace(/\nfunction seasonPhaseSegments[\s\S]*$/, "") + "; return seasonRecoveryDays;")();
assert.ok(seasonRecoveryFunction({}, {km:100,hm:3000}, {}) >= 17, "100 km mountain races must receive a substantial recovery window");
assert.ok(seasonRecoveryFunction({}, {km:10,hm:0}, {}) < seasonRecoveryFunction({}, {km:100,hm:3000}, {}), "Long mountain races must receive more recovery than short races");
const phaseMatch = html.match(/function seasonPhaseSegments\(gapDays,priority\)\{[\s\S]*?\nfunction seasonActualRecord/);
assert.ok(phaseMatch, "Training phase segmentation must be isolated for regression tests");
const phaseFn = new Function(phaseMatch[0].replace(/\nfunction seasonActualRecord[\s\S]*$/, "") + "; return seasonPhaseSegments;")();
const phases = phaseFn(70,"A");
assert.ok(phases.some(p=>p.kind==="base") && phases.some(p=>p.kind==="build") && phases.some(p=>p.kind==="taper"), "A-race training block must include base, build and taper");
assert.ok(!phases.some(p=>p.kind==="recovery"), "Post-race recovery must be accounted for separately from the training block");
assert.ok(phaseFn(70,"A").some(p=>p.kind==="taper"), "A races must include a taper phase");
assert.ok(!phaseFn(70,"C").some(p=>p.kind==="taper"), "C races should not force a taper phase");
assert.ok(phaseFn(70,"A").find(p=>p.kind==="base").days < phaseFn(70,"C").find(p=>p.kind==="base").days, "C races should preserve a larger base-training share than A races");
assert.equal(phaseFn(0,"B").length,0,"Overlapping races must not create a negative training block");
const timelineGapMatch = html.match(/function seasonTrainingGapDays\(prev,next\)\{[\s\S]*?\}/);
assert.ok(timelineGapMatch, "Season training gap must be calculated across calendar years");
const timelineGapFn = new Function("seasonActualEnd", "seasonRecoveryDays", "seasonActualRecord", timelineGapMatch[0] + "; return seasonTrainingGapDays;")(
  () => new Date("2026-12-20T12:00:00Z"),
  () => 7,
  () => ({})
);
assert.equal(timelineGapFn({}, { date: new Date("2027-01-05T12:00:00Z") }), 9, "Training blocks must continue across New Year");
assert.equal((html.match(/id="sortPlanChronologically"/g) || []).length, 1, "Planner control IDs must be unique");
const blankActualFallbackTestMatch = html.match(/function seasonRecoveryDays\(e,r,record\)\{[^}]*\}/);
assert.ok(blankActualFallbackTestMatch, "Recovery calculation must remain independently testable");
const blankActualFallbackTestFn = new Function(blankActualFallbackTestMatch[0] + "; return seasonRecoveryDays;")();
assert.equal(blankActualFallbackTestFn({}, {km:80,hm:2500}, {actualKm:"",actualHm:"",actualDurationHours:""}), 12, "Blank actual metrics must fall back to the planned race distance and elevation");
assert.equal(blankActualFallbackTestFn({}, {km:80,hm:2500}, {actualKm:25,actualHm:500,actualDurationHours:5}), 6, "Recorded actual metrics must override planned route metrics");

const attemptDateMatch = html.match(/function seasonAttemptRaceDate\(x,a\)\{[^}]*\}/);
assert.ok(attemptDateMatch, "Imported activity dates must distinguish multi-day events");
const attemptDateFn = new Function("seasonDate", "plannerRecoveryEnd", attemptDateMatch[0] + "; return seasonAttemptRaceDate;")(
  () => new Date("2027-06-01T12:00:00Z"),
  event => new Date(event.end)
);
assert.equal(attemptDateFn({e:{end:"2027-06-03T12:00:00Z"},ri:0,rec:{}},{date:"2027-06-01"}), "", "Multi-day activity start dates must not replace the actual event finish date");
assert.equal(attemptDateFn({e:{end:"2027-06-01T12:00:00Z"},ri:0,rec:{}},{date:"2027-06-01"}), "2027-06-01", "Single-day activity dates may supply the actual race date");
assert.equal(attemptDateFn({e:{end:"2027-06-03T12:00:00Z"},ri:0,rec:{actualRaceDate:"2027-06-04"}},{date:"2027-06-01"}), "2027-06-04", "Manually entered actual finish dates must take precedence");

const actualRecordMatch = html.match(/function seasonActualRecord\(x\)\{[\s\S]*?\nfunction seasonActualEnd/);
assert.ok(actualRecordMatch, "Season record merge must be testable");
const seasonActualRecord = new Function("runAttempts", "seasonAttemptRaceDate", actualRecordMatch[0].replace(/\nfunction seasonActualEnd[\s\S]*$/, "") + "; return seasonActualRecord;")(
  { race: [{ done: true, date: "2027-06-01", result: "DNF", hours: 8, minutes: 30, actualKm: 80, actualHm: 3000 }] },
  (x, a) => x.rec.actualRaceDate || a.date
);
const actualRecord = seasonActualRecord({ key: "race", rec: { actualRaceDate: "2027-06-03", actualDurationHours: 10 } });
assert.equal(actualRecord.actualRaceDate, "2027-06-03", "Manual actual finish date must override the imported activity start date");
assert.equal(actualRecord.actualDurationHours, 10, "Manual duration adjustment must override imported duration");
assert.equal(actualRecord.raceStatus, "dnf", "Recorded DNF results must inform recovery planning");




assert.ok(raceTools.includes("stationText.split(/\\r?\\n/)"), "Aid-station input must split on real line breaks");
assert.ok(raceTools.includes("stationText.trim().split(/\\r?\\n/)"), "Aid-station validation must count real input lines");
assert.ok(raceTools.includes("].join(' | ')).join('\\n')"), "Saved aid stations must be joined with real line breaks");
assert.ok(html.includes("function saveRacePlanData(id,ri,patch)") && html.includes("localStorage.setItem('trailEventDataEdits',raw)") && html.includes("queuePlannerCloudSave()"), "Race plan edits must persist locally and queue cloud synchronization");


const eventData = appEvents;
const boraEvent = eventData.find(event => event.name === "La Corsa della Bora");
assert.ok(boraEvent, "La Corsa della Bora event must exist");
const boraRoute = id => boraEvent.routes.find(route => route.id === id);
const expectedBoraStations = {
  "bora-ultra-105-3837": [["Bagnoli",13.2],["Basovizza",25.6],["Obelisk",35.3],["Contovello",46.7],["PortoPiccolo — Basislager",61.2],["Medeazza",71],["Sela na Krasu",88.6],["San Pelagio",101.7],["Santa Croce",107.4]],
  "transkarst-ultra-59-1814": [["Medeazza",9.8],["Sela na Krasu",27.4],["San Pelagio",40.6],["Santa Croce",46.2]],
  "trieste-ultra-61-2-2323": [["Bagnoli",13.2],["Basovizza",25.6],["Obelisk",35.3],["Contovello",46.7]],
  "explorer-85-2993": [["Medeazza",9.8],["San Pelagio",21.4],["Santa Croce",27]],
  "half-trail-23-3-700": [["Duino",5.5],["Medeazza",10.1],["Visogliano",19.6]]
};
for (const [id, expected] of Object.entries(expectedBoraStations)) {
  const route = boraRoute(id);
  assert.ok(route, "Every Corsa della Bora route must remain present: " + id);
  assert.deepEqual(route.aidStations.map(station => [station.name,station.km]), expected, "Official aid-station positions must match the organizer's 2027 route page: " + id);
  assert.ok(route.aidStationsSource && route.aidStations.every(station => station.verified && station.source === route.aidStationsSource), "Every imported aid station must retain its official source and verified status: " + id);
  assert.ok(route.aidStations.every(station => station.km >= 0 && station.km <= Number(route.km)), "Aid stations must be inside their route distance: " + id);
}


const transgrancanaria = appEvents.find(event => event.name === "Transgrancanaria");
assert.ok(transgrancanaria, "Transgrancanaria event must exist");
const tgcRoute = id => transgrancanaria.routes.find(route => route.id === id);
const expectedTgcStations = {
  "classic-125km-125-6764": [["Tenoya",10.7],["Arucas (Barreto)",19.3],["Teror",31.6],["Moya (Fontanales)",43.1],["El Hornillo",52.7],["Artenara",66.8],["Tejeda",79.2],["El Garañón Lodge – Vivac Aventura",90.8],["Tunte",98.4],["Ayagaures",112]],
  "advanced-81km-81-4314": [["Moya (Fontanales)",12.2],["Artenara",22.4],["Tejeda",34.8],["El Garañón – Vivac Aventura",46.4],["Tunte",55.3],["Ayagaures",66.9]]
};
for (const [id, expected] of Object.entries(expectedTgcStations)) {
  const route = tgcRoute(id);
  assert.ok(route, "Every Transgrancanaria route must remain present: " + id);
  assert.deepEqual(route.aidStations.map(station => [station.name,station.km]), expected, "Official Transgrancanaria aid-station positions must match the organizer's 2027 route page: " + id);
  assert.ok(route.aidStationsSource && route.aidStations.every(station => station.verified && station.source === route.aidStationsSource), "Every Transgrancanaria station must retain its official source and verified status: " + id);
  assert.ok(route.aidStations.every(station => station.km >= 0 && station.km <= Number(route.km)), "Transgrancanaria stations must be inside the route distance: " + id);
}


const donautrail = appEvents.find(event => event.name === "Donautrail");
assert.ok(donautrail, "Donautrail must remain present");
const donautrailExpected = {
  "linz55-55-1-1429": [["Gasthaus zur GIS",11.7],["Freiseder am Pöstlingberg",22],["Port:O Bar Ottensheim",54]],
  "linz75-76-1835": [["Pfenningberg – Mountaincamp",12],["Höllmühlstraße 67",26.5],["Gasthaus zur GIS",33],["Freiseder am Pöstlingberg",43],["Port:O Bar Ottensheim",54]],
  "linz100-100-2150": [["Pfenningberg – Mountaincamp",12],["Höllmühlstraße 67",26.5],["Gasthaus zur GIS",33],["Freiseder am Pöstlingberg",43],["Port:O Bar Ottensheim",54],["Freiwillige Feuerwehr Landshaag",75],["Stift Wilhering",90]]
};
for (const [id, expected] of Object.entries(donautrailExpected)) {
  const route = routeById(id);
  assert.ok(route, "Every Donautrail route must remain present: " + id);
  assert.deepEqual(route.aidStations.map(station => [station.name,station.km]), expected, "Donautrail aid-station positions must match the organizer's current published list: " + id);
  assert.ok(route.aidStationsSource === "https://donautrail.at/verpflegung/" && route.aidStations.every(station => station.verified && station.source === route.aidStationsSource), "Donautrail stations must retain the organizer source and verified status: " + id);
  assert.ok(route.aidStations.every(station => station.km >= 0 && station.km <= Number(route.km)), "Donautrail stations must be within each route distance: " + id);
}


const transvulcania = appEvents.find(event => event.name === "Transvulcania adidas");
assert.ok(transvulcania, "Transvulcania event must exist");
const transvulcaniaExpected = {
  "ultramarathon-73-06-4350": [["Los Canarios",7.4],["Las Deseadas",17],["El Pilar",24.8],["El Reventón",31.53],["Pico de la Cruz",46.5],["Roque de Los Muchachos",50.7],["Torre de El Time",60.7],["Puerto de Tazacorte",68]],
  "transvulcania-marathon-43-2-1884": [["El Reventón",6.8],["Pico de la Cruz",21.7],["Roque de Los Muchachos",25.9],["Torre de El Time",35.9]],
  "transvulcania-half-24-8-2097": [["Los Canarios",7.4],["Las Deseadas",17]]
};
for (const [id, expected] of Object.entries(transvulcaniaExpected)) {
  const route = transvulcania.routes.find(item => item.id === id);
  assert.ok(route, "Every Transvulcania route must remain present: " + id);
  assert.deepEqual(route.aidStations.map(station => [station.name,station.km]), expected, "Transvulcania aid-station positions must match the organizer's 2027 route pages: " + id);
  assert.ok(route.aidStationsSource && route.aidStations.every(station => station.verified && station.source === route.aidStationsSource), "Transvulcania stations must retain their official source and verified status: " + id);
  assert.ok(route.aidStations.every(station => station.km >= 0 && station.km <= Number(route.km)), "Transvulcania stations must be inside each route distance: " + id);
}


const malcesine = appEvents.find(event => event.name === "Malcesine Baldo Trail");
assert.ok(malcesine, "Malcesine Baldo Trail event must exist");
const malcesine60k = malcesine.routes.find(route => route.id === "52k-ultra-52-3541");
assert.ok(malcesine60k, "Malcesine 60K Ultra route must exist");
assert.deepEqual(malcesine60k.aidStations.map(station => [station.name,station.km]), [
  ["Bocca di Navene",8.6],["Monte Altissimo di Nago",12.3],["Rifugio Fos-Ce",26.8],["Passo Pozza della Cola",32.4],
  ["Madonna della Neve",36],["Dossioli",42],["Tratto Spino",44.5],["San Michele",55.6]
], "Malcesine 60K aid stations must match the organizer's published route description");
assert.ok(malcesine60k.aidStationsSource === "https://malcesinebaldotrail.run/de/60k/" && malcesine60k.aidStations.every(station => station.verified && station.source === malcesine60k.aidStationsSource), "Malcesine stations must retain the organizer source and verified status");
assert.deepEqual(malcesine60k.aidStations.filter(station => station.approximate).map(station => station.name), ["Madonna della Neve","Dossioli","Tratto Spino"], "Organizer's approximate kilometer positions must remain marked approximate");
assert.ok(malcesine60k.aidStations.every(station => station.km >= 0 && station.km <= Number(malcesine60k.km)), "Malcesine aid stations must be inside the 60K route");

console.log("Validated race priorities, training phases and actual-race recovery.");

assert.ok(html.includes('data-newroute="gpxUrl"'), "New race form must accept a discovered GPX download URL");
assert.ok(html.includes('data-newroute="utmbScore"'), "New race form must accept a discovered UTMB score");
assert.ok(html.includes('data-newroute="cutoffs"'), "New race form must retain automatically detected cutoff data");
assert.ok(html.includes('data-newroute="aidStations"'), "New race form must retain automatically detected aid stations");
assert.ok(html.includes("cutoffs:parseJson('cutoffs'),aidStations:parseJson('aidStations')"), "Cutoffs and aid stations must be saved in the review proposal");
assert.ok(html.includes("gpxUrl:get('gpxUrl')||null,utmbScore:"), "GPX URL and UTMB score must be saved with each proposed route");
assert.ok(html.includes("GPX-Datei / Download-Link") && html.includes("UTMB Score"), "New race form must visibly label the additional automatic data fields");
