import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('../sport-year-entry.js', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../sport-year-preview.html', import.meta.url), 'utf8');

assert.match(entry, /customElements\.define\('sport-year-entry'/);
assert.match(entry, /Sportjahr-Kern nicht geladen/);
assert.match(entry, /normalizeActivity\(a\)/);
assert.match(entry, /a\.distanceKm=a\.segments\.length\?a\.segments\.reduce\(\(sum,segment\)=>sum\+segment\.distance,0\):a\.distanceKm/);
assert.match(entry, /querySelectorAll/);
assert.match(entry, /Number\.isFinite\(value\)/);
assert.match(entry, /input\.focus\(\)/);
assert.match(entry, /liegt außerhalb des erlaubten Bereichs/);
assert.match(entry, /dispatchEvent\(new CustomEvent\('sport-year-activity'/);\nassert.match(entry, /sequence:i\+1,segmentType:x\[0\]/);
assert.match(entry, /count<1\|\|count>100/);
assert.match(entry, /Eingaben geprüft\. Noch nicht gespeichert/);
assert.match(preview, /src="sport-year\.js"/);
assert.match(preview, /src="sport-year-entry\.js"/);
assert.ok(preview.indexOf('sport-year.js') < preview.indexOf('sport-year-entry.js'), 'Core must load before the form component.');
assert.match(preview, /Nur Vorschau/);
assert.doesNotMatch(entry, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|supabase/i);

console.log('Sportjahr entry preview checks passed.');