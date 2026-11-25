import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../community.js", import.meta.url), "utf8");

assert.match(html, /<script src="\.\/community\.js"><\/script>/);
assert.match(html, /class="northbound-primary-links"/);
assert.match(js, /id='communityTabButton'/);
assert.match(js, /id="northboundCommunity"/);
assert.match(js, /data-community-view="discover"/);
assert.match(js, /data-community-view="mine"/);
assert.match(js, /from\(TABLE\)/);
assert.match(js, /eq\('owner_id',cloudUser\.id\)/);
assert.match(js, /eq\('visibility','public'\)\.eq\('publication_status','published'\)/);
assert.match(js, /visibility==='public'\?'published':'draft'/);
assert.match(js, /gpx_download_enabled:gpxEnabled/);
assert.match(js, /from\(ASSETS\)\.insert/);
assert.match(js, /storage\.from\(BUCKET\)\.upload/);
assert.match(js, /26214400/);
assert.match(js, /Bitte anmelden/);
assert.match(js, /Die Community-Datenbank ist noch nicht freigeschaltet/);

console.log("NORTHBOUND Community UI regression tests passed.");
