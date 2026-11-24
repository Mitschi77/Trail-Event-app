import assert from 'node:assert/strict';
import SportYear from '../sport-year.js';

const sport = SportYear.normalizeCatalogEntry({ code: 'padel', name: 'Padel', category: 'Racket' });
assert.equal(sport.code, 'padel');
assert.equal(sport.isActive, true);
assert.throws(() => SportYear.normalizeCatalogEntry({ code: 'x' }), /code und name/);

const triathlon = SportYear.normalizeActivity({
  id: 'tri-1',
  sportCode: 'triathlon',
  disciplineCode: 'olympic',
  activityType: 'race',
  title: 'Triathlon',
  distanceKm: 51.5,
  durationSeconds: 9000,
  segments: [
    { sequence: 3, segmentType: 'run', sportCode: 'running', distance: 10, distanceUnit: 'km' },
    { sequence: 1, segmentType: 'swim', sportCode: 'swimming', distance: 1.5, distanceUnit: 'km' },
    { sequence: 2, segmentType: 'bike', sportCode: 'cycling', distance: 40, distanceUnit: 'km' },
    { sequence: 4, segmentType: 'transition', name: 'T2', durationSeconds: 120 }
  ]
});
assert.deepEqual(triathlon.segments.map(segment => segment.segmentType), ['swim', 'bike', 'run', 'transition']);
const summary = SportYear.summarizeActivity(triathlon);
assert.equal(summary.distanceKm, 51.5, 'Gesamtdistanz bleibt auf Aktivitätsebene; Segmente werden nicht addiert.');
assert.equal(summary.segmentCount, 4);

const backyard = SportYear.normalizeBackyardResult({ rounds: 12, lapTimesSeconds: [3600, 3610], outcome: 'dnf' });
assert.equal(backyard.totalDistanceKm, 80.4);
assert.equal(backyard.lapLengthKm, 6.7);
assert.equal(backyard.rounds, 12);
assert.equal(backyard.outcome, 'dnf');
assert.equal(SportYear.normalizeBackyardResult({ rounds: 3, lapLengthKm: 5 }).totalDistanceKm, 15);
assert.throws(() => SportYear.normalizeBackyardResult({ rounds: -1 }), /Rundenanzahl/);
assert.throws(() => SportYear.normalizeActivity({ startsAt: '2026-05-02', endsAt: '2026-05-01' }), /Ende darf nicht vor dem Beginn/);
assert.throws(() => SportYear.normalizeActivity({ distanceKm: -2 }), /Distanz/);

console.log('Sportjahr activity core tests passed.');
