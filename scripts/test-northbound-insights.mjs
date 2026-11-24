import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../alpine-performance.js", import.meta.url), "utf8");
const marker = "/* NORTHBOUND: Regenerationsplanung und Event-Datenqualität */";
const start = source.indexOf(marker);
assert.notEqual(start, -1, "NORTHBOUND insights module must be present");

const listeners = {};
const document = {
  readyState: "loading",
  addEventListener(name, callback) { listeners[name] = callback; },
  getElementById() { return null; }
};
class MutationObserver { observe() {} }
const window = {};
const context = { window, document, MutationObserver, console, Intl, Date, Math, Number, Object, String, Array, Map };
vm.runInNewContext(source.slice(start), context, { filename: "northbound-insights.js" });

const api = window.NorthboundInsights;
assert.equal(typeof api.quality, "function");
assert.equal(typeof api.lastRace, "function");
assert.equal(typeof api.suggestions, "function");

const today = new Date();
const iso = today.toISOString().slice(0, 10);
const event = {
  id: "sample-event",
  name: "Sample Trail",
  date: iso,
  startLocation: "Garmisch",
  country: "Deutschland",
  routes: [{ id: "sample-route", km: 50, hm: 2500, date: iso, startLocation: "Garmisch", country: "Deutschland", maxh: 12 }]
};
const record = {
  checkedAt: today.toISOString(),
  status: "verified",
  sources: [{ url: "https://example.org/event", status: "read" }],
  eventPeriod: { startDate: iso, verified: true },
  routes: { "0": { routeId: "sample-route", date: iso, verified: true } }
};
const complete = api.quality(event, record);
assert.equal(complete.coverage, 100);
assert.equal(complete.dateVerified, true);
assert.equal(complete.read, true);
assert.equal(complete.warnings.length, 0);

const incomplete = api.quality({ id: "partial", routes: [{ km: 20 }] }, null);
assert.ok(incomplete.coverage < 100);
assert.ok(incomplete.warnings.length >= 4);

context.EVENTS = [event];
context.routeKey = (eventIndex, routeIndex) => eventIndex + ":" + routeIndex;
context.runAttempts = {
  "0:0": [{ done: true, date: iso, actualKm: 50, actualHm: 2500 }]
};
assert.equal(api.lastRace().e.name, "Sample Trail");

console.log("NORTHBOUND recovery and event-quality tests passed.");
