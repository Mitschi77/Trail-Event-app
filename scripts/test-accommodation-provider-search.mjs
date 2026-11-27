import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('const stayLinks=');
const end = html.indexOf('async function initAccommodationMap', start);
assert.ok(start >= 0 && end > start, 'stayLinks helper must exist');
const source = html.slice(start, end);
const shiftAccommodationDate = (value, days) => {
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const context = {
  shiftAccommodationDate,
  maps: query => 'https://maps.example/?q=' + encodeURIComponent(query),
  esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
};
const stayLinks = vm.runInNewContext(source + '\nstayLinks;', context);

const noFinish = stayLinks({ startLocation: 'Startdorf', country: 'Deutschland' }, { date: '2027-08-09', startLocation: 'Startdorf' });
assert.match(noFinish, /Zielbereich beim Event/);
assert.doesNotMatch(noFinish, /Startdorf|booking\.com|airbnb\.de/);

const result = stayLinks(
  { id: 'event-1', finishLocation: 'Zielort', country: 'Österreich', startLocation: 'Startdorf' },
  { id: 'route-1', date: '2027-08-09', finishLocation: 'Zielort', startLocation: 'Startdorf' }
);
assert.match(result, /Booking\.com – Unterkünfte suchen/);
assert.match(result, /Airbnb – Unterkünfte suchen/);
assert.match(result, /ss=Zielort%2C%20%C3%96sterreich/);
assert.match(result, /checkin=2027-08-08/);
assert.match(result, /checkout=2027-08-10/);
assert.doesNotMatch(result, /Startdorf/);
assert.match(result, /Bis 5 km/);
console.log('Accommodation provider search regression tests passed.');
