import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const board = readFileSync(new URL('../sport-year-board.js', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../sport-year-preview.html', import.meta.url), 'utf8');

assert.match(board, /customElements\.define\('sport-year-board'/);
assert.match(board, /document\.addEventListener\('sport-year-activity'/);
assert.match(board, /data-year/);
assert.match(board, /data-sport/);
assert.match(board, /Gesamtdistanz/);
assert.match(board, /Höhenmeter/);
assert.match(board, /Aktivitätsdetails/);
assert.match(board, /Mehrkampf-\/Aktivitätssegmente/);
assert.match(board, /durationLabel/);
assert.match(board, /segment\.sequence/);
assert.match(board, /replaceChildren/);
assert.match(board, /data-action=action/);
assert.match(board, /handleAction\(event\)/);
assert.match(board, /saveEdit\(event\)/);
assert.match(board, /this\.items = this\.items\.filter/);
assert.match(board, /item\.title = String\(data\.get\('title'\)/);
assert.match(board, /item\.distanceKm = Number\(data\.get\('distanceKm'\)/);
assert.match(board, /item\.elevationGainM = Number\(data\.get\('elevationGainM'\)/);
assert.match(board, /dataset\.editForm/);
assert.match(board, /Abbrechen/);
assert.match(board, /localStorage|sessionStorage/.test(board) ? /NEVER_MATCH/ : /render\(\)/);
assert.match(preview, /src="sport-year-board\.js"/);
assert.match(preview, /<sport-year-entry><\/sport-year-entry>/);
assert.match(preview, /<sport-year-board><\/sport-year-board>/);
assert.ok(preview.indexOf('sport-year-entry.js') < preview.indexOf('sport-year-board.js'));

console.log('Sportjahr overview board checks passed.');