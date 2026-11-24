import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const menu = html.slice(html.indexOf('class="northbound-primary-links"'), html.indexOf('</div></div></div><div class="hero"'));
const cockpit = html.match(/<section class="tab-panel" id="cockpitTab"[\s\S]*?<\/section>/)?.[0] || "";
const year = html.match(/<section class="tab-panel" id="yearTab"[\s\S]*?<section class="tab-panel" id="eventsTab"/)?.[0] || "";

assert.match(menu, /id="cockpitTabButton"[^>]*>Cockpit/);
assert.match(cockpit, /id="seasonCockpit"/);
assert.match(html, /function renderSeasonCockpit\(\)/);
assert.match(html, /if\(name==='cockpit'\)renderSeasonCockpit\(\)/);
assert.match(html, /const tabs=\{cockpit:'cockpitTab'/);
assert.match(html, /document\.getElementById\('cockpitTabButton'\)\.addEventListener\('click',\(\)=>switchTab\('cockpit'\)\)/);
assert.match(html, /const mainTabNames=\['cockpit','year','events','planner','history'\]/);
assert.match(html, /if\(cloudReady\)switchTab\('cockpit'\)/);
assert.match(html, /id="cockpitTab"[^>]*>/);
assert.doesNotMatch(html, /id="cockpitTab"[^>]*hidden/);
assert.match(html, /id="yearTab"[^>]*hidden/);
assert.match(html, /id="eventsTab"[^>]*hidden/);
assert.doesNotMatch(year, /season-dashboard|SAISONCOCKPIT/);
assert.match(html, /render\(\);initPlanner\(\);initActivityImport\(\);refreshOfficialEventDates\(\);renderSeasonCockpit\(\);/);

console.log("NORTHBOUND cockpit separation regression tests passed.");
