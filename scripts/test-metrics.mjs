import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, /function parseTcxData\(xmlText\)/, "TCX parser must remain available for Garmin exports");
assert.match(html, /\.tcx,application\/gpx\+xml,application\/vnd\.garmin\.tcx\+xml/, "route import controls must accept TCX and GPX files");

const match = html.match(/function completedRunDistance\(x\)\{[\s\S]*?\}/);
assert.ok(match, "completedRunDistance helper must exist");
const completedRunDistance = new Function("return (" + match[0] + ")")();

assert.ok(Math.abs(completedRunDistance({ r: { rounds: 3 }, route: { roundKm: 6.706, km: 6.706 }, ev: {} }) - 20.118) < 1e-9);
assert.equal(completedRunDistance({ r: { rounds: 2 }, route: { km: 8.4 }, ev: {} }), 16.8);
assert.equal(completedRunDistance({ r: { actualKm: 12.35, rounds: 3 }, route: { roundKm: 6.706, km: 6.706 }, ev: {} }), 12.35);
assert.equal(completedRunDistance({ r: {}, route: { km: 42.195 }, ev: {} }), 42.195);

console.log("Validated round-based and manually recorded run distances.");
