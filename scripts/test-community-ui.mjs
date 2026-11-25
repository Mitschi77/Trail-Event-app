import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../community.js", import.meta.url), "utf8");

assert.match(html, /<script src="\.\/community\.js"><\/script>/);
assert.match(html, /class="northbound-primary-links"/);
assert.match(js, /id='communityTabButton'/);
assert.ok(js.includes("section.id='northboundCommunity'"));
assert.ok(js.includes("const panel=root();if(panel)panel.hidden=true;return original(name);"));
assert.match(js, /data-community-view="discover"/);
assert.match(js, /data-community-view="mine"/);
assert.match(js, /from\(TABLE\)/);
assert.match(js, /eq\('owner_id',cloudUser\.id\)/);
assert.match(js, /eq\('visibility','public'\)\.eq\('publication_status','published'\)/);
assert.match(js, /visibility==='public'\?'published':'draft'/);
assert.match(js, /gpx_download_enabled:gpxEnabled/);
assert.match(js, /from\(ASSETS\)\.insert/);
assert.match(js, /storage\.from\(BUCKET\)\.upload/);
assert.match(js, /createSignedUrl/);
assert.match(js, /renderGpxVisuals/);
assert.ok(js.includes("function parseGpxText"));
assert.ok(js.includes("gpxStats?.distance_m"));
assert.match(js, /Höhenprofil/);
assert.match(js, /community-gallery/);
assert.match(js, /community_trail_reviews/);
assert.match(js, /community_trail_comments/);
assert.match(js, /community_trail_favorites/);
assert.match(js, /community_reports/);
assert.match(js, /t\.visibility==='public'&&t\.publication_status==='published'/);
assert.match(js, /GPX-Datei herunterladen/);
assert.match(js, /storage\.from\(BUCKET\)\.remove\(uploaded\)/);
assert.match(js, /26214400/);
assert.match(js, /Bitte anmelden/);
assert.match(js, /Die Community-Datenbank ist noch nicht freigeschaltet/);


const context = { window: {}, document: { readyState: "loading", addEventListener() {} } };
vm.runInNewContext(js, context, { filename: "community.js" });
const parseGpx = context.window.NorthboundCommunityGPX.parse;
const fixture = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>
<trkpt lat="47.0000" lon="12.0000"><ele>1000</ele></trkpt>
<trkpt lat="47.0000" lon="12.0100"><ele>1100</ele></trkpt>
<trkpt lat="47.0100" lon="12.0100"><ele>1050</ele></trkpt>
</trkseg></trk></gpx>`;
const stats = parseGpx(fixture);
assert.equal(stats.points.length, 3);
assert.ok(stats.distance_m > 2000 && stats.distance_m < 2500);
assert.equal(stats.ascent_m, 100);
assert.equal(stats.descent_m, 50);
assert.equal(stats.min_elevation_m, 1000);
assert.equal(stats.max_elevation_m, 1100);
assert.equal(stats.profile.length, 3);
assert.throws(() => parseGpx("<gpx><trk/></gpx>"), /weniger als zwei/);

console.log("NORTHBOUND Community UI regression tests passed.");
