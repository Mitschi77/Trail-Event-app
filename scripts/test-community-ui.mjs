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
assert.ok(js.includes("communityMinDistance"));
assert.ok(js.includes("communityMaxDistance"));
assert.ok(js.includes("communityMaxAscent"));
assert.ok(js.includes("communityRegion"));
assert.ok(js.includes("communitySurface"));
assert.ok(js.includes("communitySort"));
assert.ok(js.includes("communityResetFilters"));
assert.ok(js.includes("surface_summary"));
assert.ok(js.includes("communityResultCount"));
assert.ok(js.includes("communityDiscoveryMap"));
assert.ok(js.includes("renderDiscoveryMap(rows)"));
assert.ok(js.includes("map_location_enabled"));
assert.ok(js.includes("start_latitude"));
assert.ok(js.includes("start_longitude"));
assert.ok(js.includes("mapLocationEnabled=form.elements.map_location_enabled.checked"));
const saveTrailSource = js.slice(js.indexOf("async function saveTrail"), js.indexOf("function styles()"));
assert.ok(saveTrailSource.indexOf("const gpxStats=gpx?parseGpxText") < saveTrailSource.indexOf("const mapLocationEnabled=form.elements.map_location_enabled.checked"));
assert.ok(!saveTrailSource.slice(0, saveTrailSource.indexOf("const gpxStats=gpx?parseGpxText")).includes("gpxStats"));
assert.ok(js.includes("Startpunkt auf der öffentlichen Community-Karte anzeigen"));
assert.ok(js.includes("Nur freigegebene Startpunkte werden angezeigt."));
assert.ok(js.includes("communityDiscoveryRenderToken"));
assert.ok(js.includes("function selectDiscoveryTrail(id,focusMap=false,scrollCard=true)"));
assert.ok(js.includes("communityDiscoveryMarkersByTrail.set(t.id,marker)"));
assert.ok(js.includes(".community-card.is-map-selected"));
assert.ok(js.includes("community-show-on-map"));
assert.ok(js.includes("Auf Karte zeigen"));
assert.ok(js.includes("selectDiscoveryTrail(communitySelectedTrailId,false,false)"));
assert.ok(js.includes("communityDiscoveryMarkersByTrail.clear()"));
assert.ok(js.includes("data-community-card-id"));

assert.ok(js.includes("distance-asc"));
assert.ok(js.includes("ascent-desc"));
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
assert.ok(js.includes("function renderGpxMap(container,stats)"));
assert.ok(js.includes("tile.openstreetmap.org"));
assert.ok(js.includes("OpenStreetMap contributors"));
assert.ok(js.includes("await renderGpxMap(gallery,stats)"));
assert.ok(js.includes("function renderGpxMetrics(container,stats)"));
assert.ok(js.includes("Höhenprofil · Entfernung und Höhe"));
assert.ok(js.includes("Entfernung und Höhe"));
assert.ok(js.includes("Karte vergrößern"));
assert.ok(js.includes("aria-expanded"));
assert.ok(js.includes("community-gpx-metric"));
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
assert.ok(stats.distance_m > 1800 && stats.distance_m < 2000);
assert.equal(stats.ascent_m, 100);
assert.equal(stats.descent_m, 50);
assert.equal(stats.min_elevation_m, 1000);
assert.equal(stats.max_elevation_m, 1100);
assert.equal(stats.profile.length, 3);
assert.throws(() => parseGpx("<gpx><trk/></gpx>"), /weniger als zwei/);

console.log("NORTHBOUND Community UI regression tests passed.");
