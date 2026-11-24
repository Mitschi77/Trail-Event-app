import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /id="cockpitTabButton"[^>]*aria-controls="cockpitTab"/,
  "Cockpit must have its own navigation entry");
assert.match(html, /id="cockpitTab"[^>]*role="tabpanel"/,
  "Cockpit must have its own content panel");
assert.match(html, /id="seasonCockpit"/,
  "Cockpit must own a separate dashboard mount");
assert.match(html, /id="yearTab"[^>]*hidden/,
  "Year overview must remain a separate initially hidden panel");
assert.match(html, /id="eventsTab"[^>]*hidden/,
  "Events must not replace the cockpit as the initial start area");
assert.match(html, /const tabs=\{cockpit:'cockpitTab'/,
  "Cockpit must participate in central tab switching");
assert.match(html, /cockpitTabButton'\)\.addEventListener\('click',\(\)=>switchTab\('cockpit'\)\)/,
  "Cockpit navigation button must be wired");
assert.match(html, /if\(name==='cockpit'\)renderSeasonCockpit\(\)/,
  "Opening the cockpit must render its dashboard");
assert.match(html, /function renderSeasonCockpit\(\)[\s\S]*?Noch kein kommendes Rennen/,
  "Cockpit must render a useful empty-season state");
assert.doesNotMatch(html, /root\.innerHTML=dashboard\+/,
  "Season dashboard must no longer be embedded in the yearly overview");
assert.match(html, /renderSeasonCockpit\(\);/,
  "Cockpit must be initialized on application start");
assert.match(html, /if\(cloudReady\)switchTab\('cockpit'\)/,
  "After cloud login, the app must return to the cockpit");

console.log("Cockpit separation regression tests passed.");
