import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, /function parseTcxData\(xmlText\)/, "TCX parser must remain available for Garmin exports");
assert.ok(html.includes("async function parseActivityTrack(file)"), "Activity file parser must be async for FIT decoding");
assert.ok(html.includes("@garmin/fitsdk@21.221.0"), "FIT imports must use a pinned Garmin SDK version");
assert.ok(html.includes("result.messages?.recordMesgs"), "FIT parser must read Garmin recordMesgs");
assert.ok(html.includes("result.messages?.sessionMesgs"), "FIT parser must read Garmin sessionMesgs");
assert.ok(html.includes("manualIndex=runAttempts[key].findIndex"), "Activity imports must detect existing manual runs");
assert.ok(html.includes("Ergebnis, Platz und Bewertung bleiben erhalten."), "Activity import must preserve manual race metadata");


assert.ok(html.includes('accept=".gpx,.tcx,.fit,'), "Import controls must accept FIT, GPX and TCX files");
assert.ok(html.includes("async function importActivityToHistory()"), "Activity history import must be available");
assert.ok(html.includes("const data=await parseActivityTrack(file),route=event.routes[ri]"), "Route file import must await async FIT/TCX parsing");
assert.ok(html.includes("async function importGpxForRoute(id,ri,input)"), "Planned route detail import must support asynchronous FIT/TCX parsing");
assert.ok(html.includes("const data=await parseActivityTrack(file);if(data.track.length<2)"), "Planned route detail import must await parsed track data");


assert.ok(html.includes("initActivityImport();"), "Activity import controls must initialize");
assert.ok(html.includes("durationSeconds"), "Imported activities must retain elapsed time");
assert.ok(html.includes("function activityLocalDate(value)"), "Activity date conversion must be synchronous");
assert.ok(html.includes("const data=await parseActivityTrack(file)"), "Route imports must await asynchronous file parsing");
assert.ok(html.includes("eventValue!==''?EVENTS[Number(eventValue)]:null"), "Activity event selector must not silently choose the first event");
assert.ok(html.includes("function activityLocalDate(value)"), "Imported activity dates must use the device's local calendar");
assert.ok(html.includes("activityLocalDate(data.startTime)"), "Activity import must normalize timestamps to local dates");



const match = html.match(/function completedRunDistance\(x\)\{[\s\S]*?\}/);
assert.ok(match, "completedRunDistance helper must exist");
const completedRunDistance = new Function("return (" + match[0] + ")")();

assert.ok(Math.abs(completedRunDistance({ r: { rounds: 3 }, route: { roundKm: 6.706, km: 6.706 }, ev: {} }) - 20.118) < 1e-9);
assert.equal(completedRunDistance({ r: { rounds: 2 }, route: { km: 8.4 }, ev: {} }), 16.8);
assert.equal(completedRunDistance({ r: { actualKm: 12.35, rounds: 3 }, route: { roundKm: 6.706, km: 6.706 }, ev: {} }), 12.35);
assert.equal(completedRunDistance({ r: {}, route: { km: 42.195 }, ev: {} }), 42.195);

console.log("Validated round-based and manually recorded run distances.");
