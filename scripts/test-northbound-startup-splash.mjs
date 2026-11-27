import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const splash = readFileSync(new URL('../startup-splash.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

// External Leaflet must never block HTML parsing before the splash can render.
const leafletTag = html.match(/<script[^>]*src="https:\/\/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js"[^>]*><\/script>/);
assert.ok(leafletTag, 'Leaflet script tag is present');
assert.match(leafletTag[0], /defer/, 'Leaflet is deferred so splash markup can render immediately');
assert.ok(html.indexOf(leafletTag[0]) < html.indexOf('</head>'), 'Leaflet is loaded from the document head without blocking body parsing');
const leafletCssTag = html.match(/<link[^>]*href="https:\/\/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.css"[^>]*>/);
assert.ok(leafletCssTag, 'Leaflet stylesheet is present');
assert.match(leafletCssTag[0], /media="print"[^>]*onload=/, 'Leaflet stylesheet does not block the first paint');
const designCssTag = html.match(/<link[^>]*href="\.\/design-system\.css"[^>]*>/);
assert.ok(designCssTag, 'design system stylesheet is present');
assert.match(designCssTag[0], /media="print"[^>]*onload=/, 'design system stylesheet does not block the first paint');


assert.match(html, /id="northboundStartupSplash"/, 'startup splash markup is present');
assert.match(html, /position:fixed!important;inset:0!important/, 'splash is pinned to all viewport edges');
assert.match(html, /height:100dvh!important/, 'splash fills the dynamic iPhone viewport');
assert.match(html, /z-index:2147483647!important/, 'splash stays above the entire app');
assert.match(html, /html\.northbound-startup-lock body>\#northboundStartupSplash/, 'startup lock enforces the full-screen overlay');
assert.match(html, /northbound-logo\.svg/, 'splash uses the NORTHBOUND brand mark');
assert.match(html, /nb-splash-athlete runner/, 'trail runner animation is present');
assert.match(html, /nb-splash-athlete cyclist/, 'road cyclist animation is present');
assert.match(html, /nb-splash-runner-body/, 'runner has a natural movement cycle');
assert.match(html, /nb-splash-wheel/, 'road bike wheels animate');
assert.match(html, /nb-bike-frame/, 'road bike uses a detailed frame');
assert.ok(html.indexOf('northboundStartupSplash') < html.indexOf('<header>'), 'splash is mounted before the app header');
assert.match(splash, /nbRunnerStride/, 'runner is rendered as a filled athlete silhouette');
assert.match(splash, /nbCycleKit/, 'cyclist is rendered with filled kit shapes');
assert.match(splash, /northbound-splash-art-direction/, 'premium athlete art direction is injected');
assert.match(splash, /await window.connectPlannerCloud\(\)/, 'startup waits for the existing cloud initialization');
assert.match(splash, /finally\s*\{\s*finish\(\)/, 'splash is removed after cloud initialization settles');
assert.match(worker, /startup-splash\.js/, 'service worker caches the splash controller');
assert.match(worker, /trail-event-planner-v117/, 'service worker cache version is bumped');

console.log('NORTHBOUND startup splash checks passed.');
