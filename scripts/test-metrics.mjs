import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
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
const recoveryHelper = html.match(/const plannerRecoveryEnd=\\(event,routeIndex\\)=>\\{[^}]*\\};/);
assert.ok(recoveryHelper, "Multi-day recovery helper must be testable");
const plannerRecoveryEnd = new Function("plannerRouteDate", "eventEnd", "return (" + recoveryHelper[0].replace(/^const plannerRecoveryEnd=/, "").replace(/;$/, "") + ");")(
  (_event, _index) => new Date("2026-08-01T12:00:00Z"),
  () => new Date("2026-08-04T12:00:00Z")
);
assert.equal(plannerRecoveryEnd({}, 0).toISOString().slice(0, 10), "2026-08-04");
assert.ok(html.includes("const plannerRecoveryEnd=(event,routeIndex)=>"), "Multi-day races must expose a final-day recovery helper");
assert.ok(html.includes("end=plannerRecoveryEnd(last,lastRi)"), "Next-race suggestions must start recovery after the event end");
assert.ok(html.includes("(b.date-a.recoveryEnd)/86400000"), "Season check must compare next start to previous event end");
assert.ok(html.includes("selectedEnd&&nextDate&&nextDate<plusDays(selectedEnd,weeks*7)"), "Route selection must enforce recovery after multi-day events");
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

console.log("Validated round-based and manually recorded run distances.");
