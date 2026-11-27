import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [html, moduleSource] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../accommodation-documents.js", import.meta.url), "utf8")
]);

assert.match(html, /<script src=["']\.\/accommodation-documents\.js["']><\/script>/,
  "the per-stay document module must be loaded by the app");
assert.match(html, /CLOUD_KEYS=\['trailPrivateBookingDocuments'/,
  "per-stay document metadata must be included in cloud sync and backup");
assert.match(moduleSource, /trail-private-documents/,
  "documents must use the existing private storage bucket");
assert.match(moduleSource, /createSignedUrl\(/,
  "documents must open through short-lived signed URLs");
assert.doesNotMatch(moduleSource, /getPublicUrl\(/,
  "private booking documents must never receive public URLs");
assert.match(moduleSource, /MAX_BYTES=20\*1024\*1024/,
  "the 20 MB upload limit must remain enforced");
assert.match(moduleSource, /!window\.requirePlannerLogin\(/,
  "upload must require the existing planner login check");

const listeners = { change: [], click: [] };
const local = new Map();
const uploads = [];
const removals = [];
let signedUrlCalls = 0;
const storage = {
  upload: async (path, file, options) => { uploads.push({ path, file, options }); return { error: null }; },
  remove: async paths => { removals.push(paths); return { error: null }; },
  createSignedUrl: async () => { signedUrlCalls++; return { data: { signedUrl: "https://private.example/signed" }, error: null }; }
};
const document = {
  head: { appendChild() {} },
  createElement() { return { style: {}, setAttribute() {} }; },
  addEventListener(type, fn) { listeners[type].push(fn); },
  querySelector() { return null; }
};
const window = {
  cloudUser: { id: "user-123" },
  cloudReady: true,
  cloudClient: { storage: { from: bucket => { assert.equal(bucket, "trail-private-documents"); return storage; } } },
  readPrivatePlannerObject(key) { try { return JSON.parse(local.get(key) || "{}"); } catch { return {}; } },
  queuePlannerCloudSave() {},
  getAccommodationStays(booking) { return Array.isArray(booking.stays) ? booking.stays : []; },
  requirePlannerLogin() { return true; },
  cloudMessage() {},
  confirm() { return true; },
  confirm() { return true; },
  open() { return { location: { href: "" }, close() {} }; },
  renderYearAccommodationForm() { return '<article class="accommodation-booking-card">Stay</article>'; },
  removeAccommodationStay() {},
  EVENTS: [{ id: "event-1" }]
};
const sandbox = {
  window, document, localStorage: {
    getItem(key) { return local.get(key) ?? null; },
    setItem(key, value) { local.set(key, value); }
  },
  CSS: { escape: value => value },
  Date, String, Array, Object, Number, JSON, Math, RegExp, Promise, Error, confirm: () => true
};
sandbox.EVENTS = window.EVENTS;
vm.runInNewContext(moduleSource, sandbox, { filename: "accommodation-documents.js" });

const bookings = { "event-1": { stays: [{ id: "stay-abc", title: "Mountain Hotel" }] } };
local.set("trailPrivateBookings", JSON.stringify(bookings));
const rendered = window.renderYearAccommodationForm({}, {}, 0, 0, "test");
assert.match(rendered, /data-stay-documents="event-1"/);
assert.match(rendered, /data-stay-id="stay-abc"/);
assert.match(rendered, /Buchungsunterlagen/);

const status = { textContent: "" };
const typeSelect = { value: "invoice" };
const panel = { querySelector(selector) { return selector === ".stay-document-status" ? status : typeSelect; } };
const file = { name: "rechnung.pdf", size: 1024, type: "application/pdf" };
const input = {
  files: [file], dataset: { eventId: "event-1", stayId: "stay-abc" }, value: "",
  closest() { return panel; }
};
await listeners.change[0]({ target: { matches: selector => selector === "[data-stay-doc-upload]", ...input } });
const metadata = JSON.parse(local.get("trailPrivateBookingDocuments"));
assert.equal(uploads.length, 1, "upload must use the private storage bucket");
assert.equal(metadata["event-1"]["stay-abc"].length, 1);
assert.equal(metadata["event-1"]["stay-abc"][0].documentType, "invoice");
assert.equal(metadata["event-1"]["stay-abc"][0].originalName, "rechnung.pdf");

const openButton = { dataset: { eventId: "event-1", stayId: "stay-abc", stayDocOpen: "0" } };
await listeners.click[0]({ target: { closest(selector) { return selector === "[data-stay-doc-open]" ? openButton : null; } } });
assert.equal(signedUrlCalls, 1, "opening a document must request a signed URL");

const deleteButton = { dataset: { eventId: "event-1", stayId: "stay-abc", stayDocDelete: "0" }, closest() { return panel; } };
await listeners.click[0]({ target: { closest(selector) { return selector === "[data-stay-doc-delete]" ? deleteButton : null; } } });
assert.equal(removals.length, 1, "deleting a document must remove the private storage object");
assert.equal(JSON.parse(local.get("trailPrivateBookingDocuments"))["event-1"]["stay-abc"].length, 0);

console.log("Accommodation per-stay private document regression tests passed.");
