import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const splash = readFileSync(new URL('../startup-splash.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(html, /id="northboundStartupSplash"/, 'startup splash markup is present');
assert.match(html, /position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:0!important/, 'splash is pinned to all viewport edges');
assert.match(html, /height:100dvh!important/, 'splash fills the dynamic iPhone viewport');
assert.match(html, /z-index:2147483647!important/, 'splash stays above the entire app');
assert.match(html, /html\.northbound-startup-lock body>\#northboundStartupSplash/, 'startup lock enforces the full-screen overlay');
assert.match(html, /northbound-logo\.svg/, 'splash uses the NORTHBOUND brand mark');
assert.match(html, /nb-splash-athlete runner/, 'trail runner animation is present');
assert.match(html, /nb-splash-athlete cyclist/, 'road cyclist animation is present');
assert.ok(html.indexOf('northboundStartupSplash') < html.indexOf('<header>'), 'splash is mounted before the app header');
assert.match(splash, /await window\.connectPlannerCloud\(\)/, 'startup waits for the existing cloud initialization');
assert.match(splash, /finally\s*\{\s*finish\(\)/, 'splash is removed after cloud initialization settles');
assert.match(worker, /startup-splash\.js/, 'service worker caches the splash controller');
assert.match(worker, /trail-event-planner-v115/, 'service worker cache version is bumped');

console.log('NORTHBOUND startup splash checks passed.');
