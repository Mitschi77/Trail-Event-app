import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const designSystem = await readFile(new URL("../design-system.css", import.meta.url), "utf8");
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
assert.match(serviceWorker, /const CACHE_NAME = 'trail-event-planner-v\d+'/, "App shell cache must use a versioned cache name for the aid-station parser update");
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
assert.ok(html.includes("return saved.paymentStatus||(saved.raceStatus==='paid'||route?.paidCostStatus==='Bezahlt'?'paid':'open')"), "A verified paid receipt must set the default payment status without overriding a saved user payment status");
assert.ok(html.includes('"date":"2027-01-23","web":null,"starttime":null,"registration":null,"overnight":null,"hotelCost":null,"raceCost":"69,00 €","paidCost":"83,90 €","paidCostDate":"2026-09-17","paidCostStatus":"Bezahlt","paidCostDetails":"MOUNTAINMAN-Rechnung'), "MOUNTAINMAN 2027 date and paid total must match the invoice");
assert.match(html, /"route"\s*:\s*"mozart Ultra"\s*,\s*"km"\s*:\s*84/, "2027 Mozart route must use the verified event name");
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

const fuelScheduleStart = html.indexOf("function renderFuelSchedule(r,d){");
const fuelScheduleEnd = html.indexOf("function renderRaceStrategy", fuelScheduleStart);
assert.ok(fuelScheduleStart >= 0 && fuelScheduleEnd > fuelScheduleStart, "Fueling renderer boundaries must be present");
const fuelScheduleSource = html.slice(fuelScheduleStart, fuelScheduleEnd).trim();
const renderFuelSchedule = new Function("return (" + fuelScheduleSource + ")")();
const noFuelPlan = renderFuelSchedule({km:50}, {pace:"Infinity", fuel:60});
assert.match(noFuelPlan, /bitte Distanz und Zieltempo eintragen/);
const minFuel = renderFuelSchedule({km:50}, {pace:10, fuel:-5});
assert.match(minFuel, /Alle 15 Minuten/);
const maxFuel = renderFuelSchedule({km:100}, {pace:10, fuel:999});
assert.match(maxFuel, /Alle 240 Minuten/);
const longUltra = renderFuelSchedule({km:500}, {pace:10, fuel:15});
assert.equal((longUltra.match(/<tr>/g) || []).length, 41, "Ultra reminder table must cap at 40 data rows plus header");
assert.match(longUltra, /Anzeige ist auf 40 Erinnerungen begrenzt/, "Ultra schedule must disclose when reminders are truncated");
assert.match(longUltra, /Laufzeit ohne Pausen/, "Fuel schedule must label moving time without pauses");
const exactlyForty = renderFuelSchedule({km:61}, {pace:10, fuel:15});
assert.equal((exactlyForty.match(/<tr>/g) || []).length, 41, "A schedule with exactly 40 reminders must retain all rows");
assert.doesNotMatch(exactlyForty, /Anzeige ist auf 40 Erinnerungen begrenzt/, "A schedule with no 41st reminder must not show a truncation warning");
const noFullInterval = renderFuelSchedule({km:1}, {pace:5, fuel:60});
assert.match(noFullInterval, /kein vollständiges Verpflegungsintervall/);

const saveStrategyStart = html.indexOf("function saveRaceStrategy(id,ri){");
const saveStrategyEnd = html.indexOf("function renderRaceChecklist", saveStrategyStart);
assert.ok(saveStrategyStart >= 0 && saveStrategyEnd > saveStrategyStart, "Race strategy save handler must be present");
const saveStrategySource = html.slice(saveStrategyStart, saveStrategyEnd).trim();
const strategyInputs = {
  strategyPace7_2: { value: "9.5" }, strategyPause7_2: { value: "45" },
  strategyFuel7_2: { value: "30" }, strategyStart7_2: { value: "06:30" },
  strategyNotes7_2: { value: "Konstant anlaufen" },
  strategyResult7_2: { innerHTML: "old estimate" }, fuelSchedule7_2: { innerHTML: "old schedule" },
};
const strategyPersisted = [];
const saveStrategy = new Function(
  "document", "alert", "saveRacePlanData", "EVENTS", "renderStrategyEstimate", "renderFuelSchedule",
  saveStrategySource + ";return saveRaceStrategy;"
)(
  { getElementById: id => strategyInputs[id] || null },
  message => { throw new Error(message); },
  (id, ri, patch) => { strategyPersisted.push({ id, ri, patch }); return true; },
  { 7: { routes: [null, null, { km: 80 }] } },
  (route, data) => "estimate:" + data.pace + ":" + data.pause,
  (route, data) => "fuel:" + data.pace + ":" + data.fuel,
);
saveStrategy(7, 2);
assert.deepEqual(strategyPersisted, [{ id: 7, ri: 2, patch: { raceStrategy: { pace: "9.5", pause: "45", fuel: "30", start: "06:30", notes: "Konstant anlaufen" } } }],
  "Saving strategy must persist the edited pace, pauses and fueling interval for the selected route");
assert.equal(strategyInputs.strategyResult7_2.innerHTML, "estimate:9.5:45", "Saving strategy must refresh the target-time estimate");
assert.equal(strategyInputs.fuelSchedule7_2.innerHTML, "fuel:9.5:30", "Saving strategy must refresh the fueling schedule with the same saved pace and interval");
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
assert.ok(html.includes("const routeEntriesById=new Map()") && html.includes("filter(x=>!x.ambiguous)"), "Official date feed must prefer the canonical current route index and reject unresolved duplicate route dates");
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

assert.ok(html.includes("existing=Array.isArray(runAttempts[key])?runAttempts[key]:[]") && html.includes("manualIndex=existing.findIndex"), "Activity imports must detect existing manual runs without mutating source data before storage");
assert.ok(html.includes("Ergebnis, Platz und Bewertung bleiben erhalten."), "Activity import must preserve manual race metadata");
assert.ok(html.includes("sourceFile:file.name,sourceFileSize:file.size,sourceFileHash:fileHash,updatedAt:Date.now()"), "Merged activity imports must retain their duplicate-detection fingerprint");



assert.ok(html.includes('accept=".gpx,.tcx,.fit,'), "Import controls must accept FIT, GPX and TCX files");
assert.ok(html.includes("async function importActivityToHistory()"), "Activity history import must be available");
assert.ok(html.includes("Aktivität prüfen:"), "Activity import must show a preview before saving");
assert.ok(html.includes("distanceDelta>=.15"), "Activity import must flag material distance differences");
assert.ok(html.includes("Jetzt übernehmen?"), "Activity import preview must require confirmation");

assert.ok(html.includes("async function activityFileFingerprint(file)"), "Activity imports must fingerprint files for duplicate detection");

const persistGpxStart = html.indexOf("function persistGpxData(");
const persistGpxEnd = html.indexOf("\nasync function importRouteGpx", persistGpxStart);
assert.ok(persistGpxStart >= 0 && persistGpxEnd > persistGpxStart, "Atomic GPX persistence function boundaries must be present");
const persistGpxSource = html.slice(persistGpxStart, persistGpxEnd).trim();
function makePersistGpxHarness({failWrite=false, mismatchReadback=false, previousRaw='{"existing":{"keep":true}}'}={}) {
  const route = {id:"route-a",km:10};
  const event = {routes:[route]};
  let stored = previousRaw;
  let failNextWrite = failWrite;
  let cloudSaves = 0;
  const localStorage = {
    getItem(key) { assert.equal(key,"trailEventDataEdits"); return mismatchReadback && stored!==previousRaw ? previousRaw : stored; },
    setItem(key,value) {
      assert.equal(key,"trailEventDataEdits");
      if(failNextWrite && value!==previousRaw){failNextWrite=false;throw new Error("quota");}
      stored=value;
    },
    removeItem(key) { assert.equal(key,"trailEventDataEdits"); stored=null; }
  };
  const factory = new Function("EVENTS","routeKey","initialEdits","localStorage","queuePlannerCloudSave",
    "let eventDataEdits=initialEdits; "+persistGpxSource+"; return {persistGpxData,getEdits:()=>eventDataEdits};");
  const initialEdits={existing:{keep:true}};
  return {api:factory([event],(id,ri)=>id+":"+ri,initialEdits,localStorage,()=>cloudSaves++),
    route,event,getStored:()=>stored,getCloudSaves:()=>cloudSaves,initialEdits};
}
const gpxData={track:[[1,2],[3,4]],distanceKm:10.2,ascentHm:450,descentHm:430,elevationProfile:[{km:0,hm:100},{km:10,hm:550}]};
const successGpx=makePersistGpxHarness();
assert.equal(successGpx.api.persistGpxData(successGpx.route,successGpx.event,0,gpxData,"route.gpx"),true);
assert.equal(successGpx.route.gpxDistanceKm,10.2);
assert.equal(successGpx.api.getEdits()["0:0"].gpxFileName,"route.gpx");
assert.equal(successGpx.getStored(),JSON.stringify(successGpx.api.getEdits()));
assert.equal(successGpx.getCloudSaves(),1);
assert.throws(()=>successGpx.api.persistGpxData(successGpx.route,successGpx.event,1,gpxData,"bad.gpx"),/gehören nicht zur ausgewählten Strecke/);
const failedGpx=makePersistGpxHarness({failWrite:true});
assert.throws(()=>failedGpx.api.persistGpxData(failedGpx.route,failedGpx.event,0,gpxData,"quota.gpx"),/nicht sicher gespeichert/);
assert.equal(failedGpx.route.gpxTrack,undefined,"Failed GPX writes must not mutate the route");
assert.deepEqual(failedGpx.api.getEdits(),failedGpx.initialEdits,"Failed GPX writes must not mutate in-memory edits");
assert.equal(failedGpx.getStored(),'{"existing":{"keep":true}}',"Failed GPX writes must restore the previous storage value");
assert.equal(failedGpx.getCloudSaves(),0);
const readbackGpx=makePersistGpxHarness({mismatchReadback:true});
assert.throws(()=>readbackGpx.api.persistGpxData(readbackGpx.route,readbackGpx.event,0,gpxData,"mismatch.gpx"),/nicht sicher gespeichert/);
assert.equal(readbackGpx.route.gpxTrack,undefined,"Failed GPX read-back must not mutate the route");
assert.deepEqual(readbackGpx.api.getEdits(),readbackGpx.initialEdits);
assert.equal(readbackGpx.getStored(),'{"existing":{"keep":true}}',"Failed GPX read-back must restore prior storage");
assert.equal(readbackGpx.getCloudSaves(),0);

assert.ok(html.includes("sourceFileHash:fileHash"), "Imported activity records must persist their file fingerprint");
assert.ok(html.includes("oldAttempts=localStorage.getItem('trailEventRunAttempts'),oldRecords=localStorage.getItem('trailEventRunRecords')"), "Activity import must retain the prior local state for rollback");
assert.ok(html.includes("localStorage.getItem('trailEventRunAttempts')!==attemptsRaw") && html.includes("localStorage.getItem('trailEventRunRecords')!==recordsRaw"), "Activity import must verify both persisted records before mutating in-memory state");
assert.ok(html.includes("!Number.isInteger(ri)||!Array.isArray(event?.routes)||event.routes[ri]!==route"), "GPX persistence must validate the selected event and route identity");
assert.ok(html.includes("previousRaw=localStorage.getItem('trailEventDataEdits')") && html.includes("localStorage.setItem('trailEventDataEdits',previousRaw)"), "GPX persistence must restore the previous storage value after a failed write or read-back");
assert.ok(html.includes("previewLines.filter(Boolean).join('\\n')+'\\n\\nJetzt übernehmen?'"), "Activity confirmation must use actual newline escapes, not display literal backslash-n text");
assert.ok(html.includes("eventDataEdits=nextEdits;route.gpxTrack=data.track"), "GPX route state must only change after storage read-back succeeds");

assert.ok(html.includes("const data=await parseActivityTrack(file),route=event.routes[ri]"), "Route file import must await async FIT/TCX parsing");
const organizerRestrictedRoute = routeById("linz55-55-1-1429");
assert.equal(organizerRestrictedRoute?.gpxAvailability, "organizer-download-restricted", "Donautrail route must retain its explicit organizer GPX restriction");
assert.ok(organizerRestrictedRoute?.gpxDownloadUrl, "Restricted source URL remains available for audit but must not enable import");
assert.match(html, /function routeGpxIsOrganizerRestricted\(route\)\{[^}]*organizer-download-restricted[^}]*\}/, "Organizer GPX restriction helper must recognize the real database status");
assert.ok(html.includes("return !routeGpxIsOrganizerRestricted(route)&&!!("), "Restricted routes must not be counted as GPX-downloadable");
assert.ok(html.includes("if(routeGpxIsOrganizerRestricted({gpxAvailability:status}))return false"), "Organizer restriction must hide remote GPX import links");
assert.ok(html.includes("if(routeGpxIsOrganizerRestricted(route))throw new Error("), "Organizer restriction must block local route GPX imports");
assert.ok(html.includes("if(routeGpxIsOrganizerRestricted(route)){alert("), "Organizer restriction must block direct remote route GPX imports");

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
assert.ok(!html.includes('data-newroute="utmbScore"') && !html.includes("UTMB Score") && !html.includes("UTMB SCORE") && !html.includes("eventUtmbScoreBadge("), "UTMB score must be removed from the app UI and new race form");
assert.ok(html.includes('id="personalUtmbIndex"') && html.includes("UTMB Index"), "The personal UTMB Index must remain the single UTMB metric in the header");
assert.ok(html.includes('data-newroute="cutoffs"'), "New race form must retain automatically detected cutoff data");
assert.ok(html.includes('data-newroute="aidStations"'), "New race form must retain automatically detected aid stations");
assert.ok(html.includes("cutoffs:parseJson('cutoffs'),aidStations:parseJson('aidStations')"), "Cutoffs and aid stations must be saved in the review proposal");
assert.ok(html.includes("gpxUrl:get('gpxUrl')||null,utmbScore:"), "GPX URL and UTMB score must be saved with each proposed route");
assert.ok(html.includes("GPX-Datei / Download-Link") && html.includes("UTMB Score"), "New race form must visibly label the additional automatic data fields");
assert.ok(html.includes("utmb-category-mark") && html.includes("utmb-category-label"), "UTMB categories must use the colored category label and mountain M marker");
assert.ok(!html.includes("'20K':{color:'#f1d34f',symbol:'🟡'"), "UTMB category badges must not use emoji category symbols");

// Owner approval and public publication must remain separate.
assert.ok(html.includes("function markProposalPublished(id)"), "Owner review must provide a separate publication-documentation step");
assert.ok(html.includes("mark_event_proposal_published"), "Publication must be recorded through the owner-only database RPC");
assert.ok(html.includes("Freigegeben – wartet auf Veröffentlichung"), "Approved proposals must remain visibly distinct from published proposals");
assert.ok(html.includes("Veröffentlichung dokumentieren") && html.includes("Pages-Veröffentlichung erfolgreich"), "Publication documentation must require an explicit post-deployment confirmation");
assert.ok(html.includes("row.published_at") && html.includes("row.publication_ref"), "Review queue must display publication timestamp and evidence");
assert.ok(html.includes("github[.]com"), "Publication reference validation must accept only this repository's GitHub references or a commit SHA");

assert.ok(html.includes("schemaVersion:2") && html.includes("integrity:cloudSnapshotSignatures"), "Local and cloud backups must carry an integrity signature");
assert.ok(html.includes("parsed.schemaVersion===2") && html.includes("parsed.integrity"), "Version 2 backup imports must verify their integrity signature");
assert.ok(html.includes("applyPlannerSnapshot(restoredData)"), "Cloud restore must use the verified atomic snapshot writer");
assert.ok(html.includes("Speichern nicht bestätigt") && html.includes("Der vorherige lokale Datenstand wurde zurückgespielt"), "Snapshot writes must verify readback and roll back on failure");
const snapshotValidatorSource = html.match(/function validatePlannerSnapshot\(snapshot\)\{[^\n]*\}/);
assert.ok(snapshotValidatorSource, "Cloud and backup snapshots must have a shared validator");
const validatePlannerSnapshot = new Function("CLOUD_KEYS", snapshotValidatorSource[0] + "; return validatePlannerSnapshot;")(["plannerKey"]);
assert.deepEqual(validatePlannerSnapshot({plannerKey: JSON.stringify({ok:true})}), {plannerKey: JSON.stringify({ok:true})});
assert.throws(() => validatePlannerSnapshot({unknownKey: "{}"}), /Unbekannter oder ungültiger Datenbereich/);
assert.throws(() => validatePlannerSnapshot({plannerKey: "{"}), /Beschädigte Daten/);
assert.notDeepEqual(cloudSignature({plannerKey:"old"}), cloudSignature({plannerKey:"new"}), "Backup integrity signatures must change when stored data changes");


// Execute the actual activity-import storage transaction from index.html.
// The second write is forced to fail after the first write has succeeded.
const activityStorageStart = html.indexOf("const attemptsRaw=JSON.stringify(nextAttempts)");
const activityStorageMarker = "runAttempts=nextAttempts;runRecords=nextRecords;";
const activityStorageEnd = html.indexOf(activityStorageMarker, activityStorageStart);
assert.ok(activityStorageStart >= 0 && activityStorageEnd > activityStorageStart,
  "Activity import storage transaction must remain extractable for failure testing");
const activityStorageSource = html.slice(activityStorageStart, activityStorageEnd + activityStorageMarker.length);
function makeActivityStorageHarness({ failRecordsWrite = false } = {}) {
  const initialAttempts = { "0:0": [{ date: "2026-01-01", result: "Platz" }] };
  const initialRecords = { "0:0": { done: false, year: "2026" } };
  let runAttempts = initialAttempts;
  let runRecords = initialRecords;
  const values = new Map([
    ["trailEventRunAttempts", JSON.stringify(initialAttempts)],
    ["trailEventRunRecords", JSON.stringify(initialRecords)]
  ]);
  let failNextRecordsWrite = failRecordsWrite;
  let cloudSaves = 0;
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (key === "trailEventRunRecords" && failNextRecordsWrite) {
        failNextRecordsWrite = false;
        throw new Error("simulated quota failure on second write");
      }
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); }
  };
  const execute = new Function("nextAttempts", "nextRecords", "localStorage",
    "queuePlannerCloudSave", "initialAttempts", "initialRecords",
    "let runAttempts=initialAttempts,runRecords=initialRecords;" +
    activityStorageSource +
    ";queuePlannerCloudSave();return {runAttempts,runRecords};");
  const nextAttempts = { "0:0": [{ date: "2026-11-20", source: "file" }] };
  const nextRecords = { "0:0": { done: true, year: "2026" } };
  return {
    execute: () => execute(nextAttempts, nextRecords, localStorage, () => cloudSaves++, initialAttempts, initialRecords),
    values, initialAttempts, initialRecords, nextAttempts, nextRecords,
    getCloudSaves: () => cloudSaves
  };
}
const failedActivityStorage = makeActivityStorageHarness({ failRecordsWrite: true });
assert.throws(() => failedActivityStorage.execute(), /Import nicht gespeichert/);
assert.equal(failedActivityStorage.values.get("trailEventRunAttempts"),
  JSON.stringify(failedActivityStorage.initialAttempts),
  "A failed second write must roll back the already-written activity attempts");
assert.equal(failedActivityStorage.values.get("trailEventRunRecords"),
  JSON.stringify(failedActivityStorage.initialRecords),
  "A failed second write must preserve the prior event status");
assert.deepEqual(failedActivityStorage.initialAttempts, { "0:0": [{ date: "2026-01-01", result: "Platz" }] },
  "Original in-memory attempts must remain unchanged after a failed import");
assert.deepEqual(failedActivityStorage.initialRecords, { "0:0": { done: false, year: "2026" } },
  "Original in-memory records must remain unchanged after a failed import");
assert.equal(failedActivityStorage.getCloudSaves(), 0,
  "A failed activity import must not queue cloud synchronization");

// Year overview: compact, accessible cards expose the actual route profile and cut-off data.
assert.ok(html.includes('class="year-race-more"') && html.includes('Unterkunft &amp; Buchung') && html.includes('Strecke &amp; Eventdetails'),
  "Year race details must separate accommodation and route information into two native disclosure sections");
assert.ok(html.includes('class="year-race-head"'), "Year overview must render compact race-card headings");
assert.ok(html.includes("yearAccommodation=renderYearAccommodationForm") && html.includes("yearInvoices=renderEventInvoices") && html.includes("profileInfo+detailButton+repeatButton"),
  "Year cards must render accommodation, invoices, elevation profile, cut-offs and route metrics in their respective sections");
assert.ok(html.includes('yearAccommodation=renderYearAccommodationForm'),
  "The year card must actually render the accommodation form, not only define it");
assert.ok(html.includes("'+soldOutRouteBadge(x.r)+statusControl+review+'<details class=\"year-race-more\"><summary>Unterkunft"),
  "Run result entry must be directly visible on the year card outside the collapsible detail sections");
assert.ok(html.includes('onclick="addEventToYearPlan(${id},${ri})"'),
  "The event route card must wire its annual planning action to the add handler");
assert.ok(html.includes('const profileInfo=') && html.includes("+derivedPanel+profilePanel+cutoffPanel+pngPanel+"),
  "Year overview profile section must retain derived metrics, elevation profile, cut-off and optional route image");
assert.ok(html.includes('aria-controls="yearReview'),
  "Year review toggle must expose the controlled panel to assistive technology");
assert.ok(html.includes('year-profile-panels') && html.includes('renderElevationProfile(x.r,x.e,safeFrameUrl)') && html.includes('renderCutoffDetails(x.r)'),
  "Year cards must keep the route elevation profile and cut-off renderer wired in");

assert.ok(html.includes('Lauf in die Jahresplanung') && html.includes('function addEventToYearPlan(id,ri)'),
  "Every route card must offer a direct action to add the selected route to the annual plan");
assert.ok(html.includes('function renderYearAccommodationForm') && html.includes('function saveYearAccommodation(id,uid)'),
  "The annual overview must provide a complete accommodation form with a persistent save action");
assert.ok(html.includes("field('Check-in','CheckIn'") && html.includes("field('Check-out','CheckOut'") &&
  html.includes("field('Gesamtpreis (€)','Price'") && html.includes("field('Bereits bezahlt (€)','Paid'"),
  "Accommodation inputs must include dates, total price and paid amount");
assert.ok(html.includes('trailPrivateBookings') && html.includes('queuePlannerCloudSave()'),
  "Accommodation changes must use the existing private cloud-synchronized booking store");
assert.ok(html.includes('Lauf eintragen / Ergebnis bearbeiten') && html.includes('savePlannedRun('),
  "The year card must expose run result, actual distance, elevation, duration and rating inputs directly");
assert.ok(html.includes('#yearOverview .year-group{display:grid') && html.includes('@media(min-width:760px)') && html.includes('year-jumpbar'),
  "The annual overview must support tablet two-column cards and quick year navigation");
assert.ok(html.includes("String(year).replace(/[^a-zA-Z0-9_-]/g,'_')") &&
  html.includes("const safeUid=String(uid).replace(/[^a-zA-Z0-9_-]/g,'_')"),
  "Jump targets and accommodation form identifiers must be valid for all event keys");
assert.ok(/trail-event-planner-v[0-9]+/.test(serviceWorker),
  "The PWA cache must be versioned for the updated release");

assert.ok(html.includes('season-dashboard') && html.includes('season-next-race') && html.includes('season-dashboard-stats'),
  "The annual overview must render one canonical season dashboard with next-race and season KPI sections");
assert.ok(seasonTools.includes("details.addEventListener('toggle'") && seasonTools.includes("aria-current"),
  "Opening a month manually must keep the month shortcut navigation in sync");
assert.ok(seasonTools.includes(".year-race-status-controls{display:grid") && seasonTools.includes(".year-race-more>summary"),
  "Annual race cards must use compact responsive status controls and clear expandable detail sections");
assert.ok(!seasonTools.includes('seasonDashboard') && seasonTools.includes('year-month-group') && seasonTools.includes('groupYearMonths'),
  "The season module must not duplicate the dashboard and must group existing annual race cards into month accordions");
assert.ok(seasonTools.includes('year-month-nav') && seasonTools.includes('data-month-target') && seasonTools.includes("target.scrollIntoView"),
  "Each year must expose horizontal month shortcuts that open and scroll to the selected month");
assert.ok(seasonTools.includes('window.renderYearOverview=function(){originalYearOverview();groupYearMonths();}') && seasonTools.includes('year-month-races'),
  "Month accordions must refresh after each annual overview render and preserve the original race cards");

assert.ok(html.includes('--bg:#101713') && html.includes('--ink:#f0f5f1') && html.includes('color-scheme:dark'),
  "The existing fixed dark theme and readable contrast tokens must remain in place");


// Explanatory help must be tucked behind accessible green information controls.
const infoTipCount = (html.match(/class="info-tip"/g) || []).length;
assert.ok(infoTipCount >= 7, "Core app sections must provide contextual information behind the info icon");
assert.ok(html.includes('aria-label="Informationen zur Jahresübersicht"') &&
  html.includes('aria-label="Informationen zum Eventplaner"') &&
  html.includes('aria-label="Informationen zur Laufhistorie"'),
  "Year overview, event planner and run history info controls must have descriptive accessible labels");
assert.ok(html.includes('aria-label="Informationen zu Suche und Filtern"') &&
  html.includes('aria-label="Informationen zum Aktivitätsimport"') &&
  html.includes('aria-label="Informationen zum Hinzufügen eines Events"'),
  "Search, activity import and event creation help must be accessible");
assert.ok(html.includes('class="info-tip-content"') &&
  html.includes('.info-tip summary:focus-visible') &&
  html.includes('.info-tip-content{'),
  "Info controls must use the existing keyboard-focusable green icon and readable disclosure panel");
assert.ok(html.includes('Eine automatische Kontosynchronisierung mit Garmin oder Strava ist derzeit nicht verbunden.'),
  "Activity import help must not overstate direct Garmin or Strava synchronization");
assert.ok(html.includes('Der Vorschlag bleibt bis zu deiner Freigabe unveröffentlicht.') &&
  html.includes('Erst nach deiner ausdrücklichen Freigabe'),
  "New event help must preserve manual approval before public publication");

// Event detail and annual overview share the same accommodation editor and save path.
assert.ok(html.includes("group('Unterkunft &amp; Buchung'") &&
  html.includes("renderYearAccommodationForm(e,r,id,ri,'detail_'+e.id+'_'+r.id)") &&
  html.includes('renderEventAccommodation(e,r,id,ri)'),
  "Event detail dialog must reuse the annual overview accommodation form and booking summary");
assert.ok(html.includes("if(!document.getElementById('plannedEventDetailModal')?.hidden)showPlannedEventDetails(id,ri)"),
  "Saving accommodation from the event detail dialog must refresh the displayed booking summary");
assert.ok(html.includes('.event-detail-accommodation-stack .year-accommodation-form') && html.includes('@media(max-width:520px){.event-detail-accommodation-stack .year-accommodation-form .edit-grid{grid-template-columns:minmax(0,1fr)}}'),
  "The shared accommodation form must fit narrow iPhone screens and tablet widths");


const soldOutHelperStart=html.indexOf("function routeSoldOut(r){");
const soldOutHelperEnd=html.indexOf("}",soldOutHelperStart);
const soldOutHelper=soldOutHelperStart>=0&&soldOutHelperEnd>soldOutHelperStart?html.slice(soldOutHelperStart,soldOutHelperEnd):"";
assert.ok(soldOutHelper.includes("r?.soldOut==='boolean'") && soldOutHelper.includes("r?.registrationStatus==='sold_out'"),
  "Sold-out state must come from explicit registration availability");
assert.ok(!soldOutHelper.includes("raceStatus") && !soldOutHelper.includes("raceCost") && !soldOutHelper.includes("r?.status"),
  "Race progress, payment and generic status must not trigger the SOLD OUT stamp");

// The same red SOLD OUT stamp must appear in event catalog, year cards, and detail dialogs.
assert.ok(html.includes("function soldOutRouteBadge(r)") && html.includes("return routeSoldOut(r)?'<span class=\"sold-out-stamp\""),
  "Sold-out routes must use the established red stamp helper");
assert.ok(html.includes("'+soldOutRouteBadge(x.r)+statusControl+review+"),
  "The annual overview must show the SOLD OUT stamp on the selected route card");
assert.ok(html.includes("const routeData=soldOutRouteBadge(r)+'<div class=\"event-detail-data\">"),
  "The event detail dialog must use the same SOLD OUT stamp as the event list");

 
// Rennfortschritt und Zahlung sind getrennte persönliche Statusfelder.
assert.ok(html.includes("function setRacePaymentStatus(id,ri,status)") && html.includes("runRecords[key].paymentStatus=status"),
  "Payment status must have its own private per-route field and save handler");
assert.ok(html.includes("function racePaymentStatus(id,ri,route)"),
  "Imported paid receipts must remain a fallback for the payment status");
assert.ok(html.includes('Zahlungsstatus<select onchange="setRacePaymentStatus('),
  "Event details must expose payment status separately from race progress");
assert.ok(html.includes("year-race-status-controls") && html.includes("paymentStatus=racePaymentStatus(x.id,x.ri,x.r)"),
  "Year overview cards must display race progress and payment status independently");
assert.ok(!html.includes('<option value="paid" ${r.raceStatus==='),
  "Run history must not offer paid as a race progress status");

assert.ok(html.includes("if(runRecords[key].raceStatus==='paid'&&!runRecords[key].paymentStatus)runRecords[key].paymentStatus='paid'"),
  "Legacy paid race status must migrate to payment status before race progress is edited");

assert.ok(html.includes('class="event-detail-overview"'), "Planned event details must show a compact route overview");
assert.ok(html.includes("overviewMetric('Distanz',r.km,'km')"), "Compact overview must show the route distance when available");
assert.ok(html.includes("routeMetricType(id)==='Marathon'"), "Marathon details must continue to omit trail elevation metrics");
assert.ok(html.includes("r.gpxStatusNote||((Array.isArray(r.gpxTrack)"), "Compact overview must show only a grounded GPX status");

// Explicit organizer GPX prohibitions get a visible red lock stamp in planned event details.
assert.ok(html.includes("const gpxRestricted=routeGpxIsOrganizerRestricted(r)"),
  "Event details must use the existing explicit organizer restriction predicate");
assert.ok(html.includes("GPX durch Veranstalter gesperrt"),
  "An explicitly prohibited GPX route must show the red organizer lock stamp");
assert.ok(html.includes("const importData=gpxRestricted?'':"),
  "The GPX file import control must be hidden when the organizer explicitly prohibits GPX use");
assert.ok(html.includes("const gpxOverview=gpxRestricted?'⛔ Durch Veranstalter untersagt':"),
  "The compact route overview must show the explicit GPX prohibition status");
assert.ok(html.includes("Bereits gespeicherte Streckendaten bleiben unverändert erhalten."),
  "The prohibition notice must confirm existing stored GPX data is retained");


// Published GPX route data is planning-only and must carry an organizer-currentness disclaimer.
assert.ok(html.includes("Die hier in der App veröffentlichte GPX-Strecke dient ausschließlich der Planung."),
  "GPX help must clearly state that published route data is for planning only");
assert.ok(html.includes("Für Richtigkeit, Vollständigkeit und Aktualität übernehmen wir keine Gewähr."),
  "GPX help must disclaim guarantees for correctness, completeness and currentness");
assert.ok(html.includes("Bitte lade vor Eventbeginn immer die aktuellste GPX-Datei direkt beim Veranstalter herunter und verwende diese."),
  "GPX help must instruct runners to use the latest organizer GPX before the event");


// Alpine Performance season cockpit refresh: hierarchy and mobile-safe overview styling.
assert.ok(html.includes('class="season-dashboard-heading"'),
  "The year overview must introduce a clear season cockpit heading");
assert.ok(html.includes("Dein Trailjahr auf einen Blick"),
  "The season cockpit must explain its purpose at a glance");
assert.ok(html.includes('id="trail-season-cockpit-refresh-v96"'),
  "The season cockpit refresh stylesheet must be present");
assert.ok(html.includes("#yearTab .season-dashboard-stats") && html.includes("@media(max-width:760px)"),
  "The season cockpit must retain responsive mobile layout rules");
assert.ok(html.includes("#yearTab .year-race-more>summary"),
  "Expandable race details must remain visually consistent and discoverable");


// Alpine Performance event and route card visual regression checks.
assert.ok(html.includes('id="trail-event-route-cards-v97"'),
  "The event and route card design layer must be present");
assert.ok(html.includes("#events .eventhead") && html.includes("#events .route"),
  "Event headers and route cards must receive the unified visual treatment");
assert.ok(html.includes("#events .routefoot") && html.includes("grid-template-columns:minmax(0,1fr)"),
  "Route actions must remain full-width and touch-friendly on narrow screens");
assert.ok(html.includes("#events .event.event-done") && html.includes("#events .route-done"),
  "Completed event and route states must remain visually distinguishable");
assert.ok(html.includes("prefers-reduced-motion:reduce"),
  "Event card transitions must respect reduced-motion preferences");


// Alpine Performance personal race archive visual regression checks.
assert.ok(html.includes('id="trail-history-archive-v98"'),
  "The personal race archive design layer must be present");
assert.ok(html.includes("#historyTab #historyStats") && html.includes("#historyTab #historyList"),
  "History statistics and race entries must receive the unified archive layout");
assert.ok(html.includes("#historyTab #historyList>.plan-card"),
  "Each completed race must be presented as an individual archive card");
assert.ok(html.includes("#historyTab #historyList .overview-stars"),
  "The existing four-star race rating must remain clearly visible");
assert.ok(html.includes("@media(max-width:760px)") && html.includes("grid-template-columns:minmax(0,1fr)"),
  "History cards must collapse to a readable single column on mobile");


// Alpine Performance accommodation planning card visual regression checks.
assert.ok(html.includes('id="trail-accommodation-cards-v99"'),
  "The integrated accommodation planning design layer must be present");
assert.ok(html.includes("#yearTab .year-accommodation-form .edit-grid") && html.includes(".event-detail-accommodation-stack .year-accommodation-form .edit-grid"),
  "Accommodation forms must share the same visual treatment in year cards and event details");
assert.ok(html.includes("#yearTab .year-race-more-content>.stay .staylinks a"),
  "Accommodation search links must be presented as consistent accessible actions");
assert.ok(html.includes("color-scheme:dark") && html.includes("@media(max-width:560px)"),
  "Accommodation inputs must remain readable and stack on narrow mobile screens");
assert.ok(html.includes("function saveYearAccommodation") && html.includes("function renderYearAccommodationForm"),
  "The existing accommodation saving and rendering flows must remain intact");


// Responsive Alpine navigation: sticky, touch-friendly, keyboard-accessible and reduced-motion aware.
assert.ok(html.includes('id="trail-navigation-ux-v100"'), "The refreshed navigation stylesheet must be present");
assert.ok(html.includes(".tabbar{position:sticky"), "The main navigation must remain available while scrolling");
assert.ok(html.includes("scroll-snap-type:x proximity"), "The mobile navigation must support guided horizontal scrolling");
assert.ok(html.includes("min-height:44px"), "Navigation controls must retain comfortable touch targets");
assert.ok(html.includes(":focus-visible"), "Navigation controls must expose visible keyboard focus");
assert.ok(html.includes("@media(prefers-reduced-motion:reduce)"), "Navigation must respect reduced-motion preferences");


// Alpine Performance route detail visual regression checks.
assert.ok(designSystem.includes(".event-detail-overview .event-detail-metric"), "Route overview metrics must use the refreshed visual hierarchy");
assert.ok(designSystem.includes(".event-detail-overview .event-detail-metric"), "Route metrics must retain a consistent compact card layout");
assert.ok(designSystem.includes(".event-detail-overview .event-detail-gpx"), "GPX planning information must remain clearly separated from route metrics");
assert.ok(designSystem.includes("@media(max-width:480px){.event-detail-overview"), "Route metrics must remain readable on narrow iPhone screens");
assert.ok(designSystem.includes("@media(prefers-reduced-motion:no-preference)"), "Route detail hover polish must respect reduced-motion preferences");


// Alpine Performance v102 – yearly timeline visual hierarchy and mobile controls.
assert.ok(seasonTools.includes(".year-month-races .year-race{margin:7px 0;padding:12px"), "Yearly race entries must render as distinct compact cards");
assert.ok(seasonTools.includes(".year-month-chip:focus-visible"), "Month navigation chips must expose keyboard focus");
assert.ok(seasonTools.includes("@media(max-width:420px){.year-month-races"), "Yearly race cards must remain compact on narrow phones");
assert.ok(seasonTools.includes("@media(prefers-reduced-motion:reduce){.year-month-chip"), "Timeline transitions must respect reduced-motion preferences");
assert.ok(seasonTools.includes(".year-month-group[open]>summary"), "The active month must have a clear expanded state");


// Web Push setup must explicitly register the service worker from the user action.
assert.ok(html.includes("navigator.serviceWorker.register(new URL('./sw.js',document.baseURI)"), "Push setup must not depend solely on the asynchronous page-load registration");
assert.ok(html.includes("Notification.requestPermission()") && html.indexOf("Notification.requestPermission()") < html.indexOf("navigator.serviceWorker.register(new URL('./sw.js',document.baseURI)"), "iOS permission request must remain before the first awaited service-worker setup");
assert.ok(html.includes("Gerät wird sicher mit deinem Konto verknüpft"), "Push setup must expose progress while saving the device subscription");
assert.ok(html.includes("id=\"enableReviewNotifications\"") && html.includes("window.trailReviewPushClick(event)"), "Push setup button must keep a direct, explicit click handler");

// Alpine Performance v103 – clear planned/completed state and compact season timeline.
assert.ok(seasonTools.includes("season-state-pill '+(completed?'is-completed':'is-planned')"), "Season cards must distinguish completed and planned races");
assert.ok(seasonTools.includes("Als gelaufen markiert") && seasonTools.includes("Noch nicht als gelaufen markiert"), "State decoration must preserve the existing race completion source text");
assert.ok(seasonTools.includes("#seasonRaceCards .season-recovery label:last-child input"), "Recovery estimates must be visually distinct from editable actual values");
assert.ok(seasonTools.includes("#seasonTimeline .season-block") && seasonTools.includes("scroll-snap-type:x proximity"), "Season timeline blocks must remain clear and navigable on mobile");
assert.ok(seasonTools.includes("@media(prefers-reduced-motion:reduce){#seasonTimeline"), "Season timeline must respect reduced-motion preferences");
