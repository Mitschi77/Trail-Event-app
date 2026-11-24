import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../SPORTJAHR-SCHEMA-VORSCHAU.sql', import.meta.url), 'utf8');

assert.match(sql, /NICHT AUSFÜHREN/);
assert.match(sql, /create table if not exists public\.sports_catalog/i);
assert.match(sql, /create table if not exists public\.sport_activities/i);
assert.match(sql, /create table if not exists public\.sport_activity_segments/i);

for (const table of ['sports_catalog', 'sport_activities', 'sport_activity_segments']) {
  assert.match(sql, new RegExp('alter table public\\.' + table + ' enable row level security', 'i'));
}

for (const policy of [
  'sports_catalog_read_policy',
  'sports_catalog_insert_policy',
  'sports_catalog_update_policy',
  'sports_catalog_delete_policy',
  'sport_activities_select_policy',
  'sport_activities_insert_policy',
  'sport_activities_update_policy',
  'sport_activities_delete_policy',
  'sport_activity_segments_select_policy',
  'sport_activity_segments_insert_policy',
  'sport_activity_segments_update_policy',
  'sport_activity_segments_delete_policy'
]) {
  assert.ok(sql.includes(policy), 'Missing RLS policy: ' + policy);
}

for (const guard of [
  'sport_year_check_catalog_parent',
  'sport_year_check_activity_sport',
  'sport_year_check_segment_references'
]) {
  assert.ok(sql.includes(guard), 'Missing ownership guard: ' + guard);
}

assert.doesNotMatch(sql, /security\\s+definer/i);
assert.doesNotMatch(sql, /grant\\s+[^;]*\\s+to\\s+anon/i);
assert.doesNotMatch(sql, /(?:drop|truncate)\\s+table\\s+public\\.planner_data/i);
assert.doesNotMatch(sql, /alter\\s+table\\s+public\\.planner_data/i);

console.log('Sportjahr schema security checks passed.');
