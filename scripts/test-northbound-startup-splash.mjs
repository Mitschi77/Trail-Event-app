import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const splash = readFileSync(new URL('../startup-splash.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const leafletTag = html.match(/<script[^>]*src="https:\/\/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js"[^>]*><\/script>/);
assert.ok(leafletTag, 'Leaflet script tag is present');
assert.match(leafletTag[0], /defer/, 'Leaflet is deferred so splash markup can render immediately');
assert.ok(html.indexOf(leafletTag[0]) < html.indexOf('</head>'), 'Leaflet is loaded from the document head');
const leafletCssTag = html.match(/<link[^>]*href="https:\/\/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.css"[^>]*>/);
assert.ok(leafletCssTag, 'Leaflet stylesheet is present');
assert.match(leafletCssTag[0], /media="print"[^>]*onload=/, 'Leaflet stylesheet does not block first paint');
const designCssTag = html.match(/<link[^>]*href="\.\/design-system\.css"[^>]*>/);
assert.ok(designCssTag, 'design system stylesheet is present');
assert.match(designCssTag[0], /media="print"[^>]*onload=/, 'design system stylesheet does not block first paint');

assert.match(html, /id="northboundStartupSplash"/, 'startup splash markup is present');
assert.match(html, /position:fixed!important;inset:0!important/, 'splash is fixed to viewport edges');
assert.match(html, /z-index:2147483647!important/, 'splash stays above the app');
assert.match(html, /northbound-logo\.svg/, 'splash uses the NORTHBOUND brand mark');
assert.match(html, /nb-splash-athlete runner/, 'trail runner animation is present');
assert.match(html, /nb-splash-athlete cyclist/, 'road cyclist animation is present');
assert.ok(html.indexOf('northboundStartupSplash') < html.indexOf('<header>'), 'splash is mounted before app content');

assert.match(splash, /\.nb-splash-athlete/, 'athlete elements are targeted');
assert.match(splash, /display:none!important;visibility:hidden!important;animation:none!important/, 'athlete artwork and animations are fully disabled');
assert.doesNotMatch(splash, /nb-splash-logo-first|nbRunnerStride|nbCyclistPedal/, 'no delayed athlete animation remains');
assert.match(splash, /northbound-splash-static-brand/, 'splash uses the static brand-only presentation');
assert.match(splash, /height: '100dvh'/, 'splash uses the dynamic iPhone viewport height');
assert.match(splash, /width: '100vw'/, 'splash spans the full viewport width');
assert.match(splash, /bottom: '0'/, 'splash explicitly covers the bottom edge');
assert.match(splash, /body\.classList\.add\('northbound-startup-lock'\)/, 'body scrolling is locked while splash is visible');
assert.match(splash, /await window\.connectPlannerCloud\(\)/, 'startup waits for cloud initialization');
assert.match(splash, /finally\s*\{\s*finish\(\)/, 'splash is removed after cloud initialization settles');
assert.match(worker, /startup-splash\.js/, 'service worker caches the splash controller');
assert.match(worker, /trail-event-planner-v118/, 'service worker cache version is bumped');

console.log('NORTHBOUND startup splash checks passed.');
