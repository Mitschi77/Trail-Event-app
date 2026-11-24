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
assert.equal(summary.durationSeconds, 9000, 'Trainingsdauer bleibt einmalig auf Aktivitätsebene; Wechselzeiten werden nicht doppelt addiert.');
assert.equal(triathlon.segments.filter(segment => segment.durationSeconds !== null).reduce((sum, segment) => sum + segment.durationSeconds, 0), 120, 'Wechselzeit bleibt als Segmentdetail erhalten und wird nicht zur Aktivitätsdauer addiert.');
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
assert.throws(() => SportYear.normalizeActivity({ startsAt: 'kein-datum' }), /gültiger Zeitpunkt/);
assert.throws(() => SportYear.normalizeActivity({ segments: [{ sequence: 1 }, { sequence: 1 }] }), /Reihenfolge muss eindeutig/);
assert.throws(() => SportYear.normalizeBackyardResult({ rounds: 1, lapTimesSeconds: [3600, 3610] }), /mehr Rundenzeiten/);
assert.throws(() => SportYear.normalizeBackyardResult({ rounds: 2, eliminatedAfterRound: 3 }), /Ausscheidungsrunde/);


const tennis = SportYear.normalizeSportResult('tennis', {
  opponent: 'Gast',
  sets: [{ home: 6, away: 4 }, { home: 7, away: 6, tieBreakHome: 7, tieBreakAway: 4 }]
});
assert.equal(tennis.format, 'racket_match');
assert.equal(tennis.sets.length, 2);
assert.equal(tennis.sets[1].tieBreakHome, 7);
assert.throws(() => SportYear.normalizeSportResult('padel', { sets: [{ home: -1, away: 2 }] }), /ganze Zahl/);
assert.throws(() => SportYear.normalizeSportResult('tennis', { sets: [{ home: 6, away: 4, tieBreakHome: 7 }] }), /beider Seiten/);
assert.equal(SportYear.normalizeSportResult('tennis', {}).outcome, 'scheduled');

const football = SportYear.normalizeSportResult('football', {
  team: 'Heimteam', opponent: 'Gastteam', scoreFor: 3, scoreAgainst: 1, minutesPlayed: 90
});
assert.equal(football.format, 'team_match');
assert.equal(football.outcome, 'win');
assert.equal(football.scoreFor, 3);
const plannedMatch = SportYear.normalizeSportResult('football', { team: 'Heimteam', opponent: 'Gastteam' });
assert.equal(plannedMatch.scoreFor, null);
assert.equal(plannedMatch.outcome, 'scheduled');
assert.throws(() => SportYear.normalizeSportResult('football', { scoreFor: 1 }), /gemeinsam/);
assert.throws(() => SportYear.normalizeSportResult('football', { scoreFor: 1, scoreAgainst: -1 }), /ganze Zahl/);

const strength = SportYear.normalizeSportResult('strength_training', {
  exercises: [
    { name: 'Kniebeugen', sets: [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }] },
    { name: 'Plank', sets: [{ durationSeconds: 60, weightKg: null }] }
  ]
});
assert.equal(strength.exercises.length, 2);
assert.equal(strength.exercises[0].sets[0].weightKg, 60);
assert.equal(strength.exercises[1].sets[0].durationSeconds, 60);
assert.throws(() => SportYear.normalizeSportResult('fitness', { exercises: [{ name: 'Plank', sets: [{}] }] }), /Wiederholungen oder eine Dauer/);
assert.throws(() => SportYear.normalizeSportResult('fitness', {
  exercises: [{ name: 'Bankdrücken', sets: [{ reps: -2 }] }]
}), /ganze Zahl/);

const customResult = SportYear.normalizeSportResult('archery', { arrows: 60, points: 512 });
assert.equal(customResult.format, 'archery');
assert.equal(customResult.points, 512);

console.log('Sportjahr activity core tests passed.');
