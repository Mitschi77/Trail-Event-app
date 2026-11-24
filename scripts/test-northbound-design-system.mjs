import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [css, season] = await Promise.all([
  readFile(new URL("../design-system.css", import.meta.url), "utf8"),
  readFile(new URL("../season-tools.js", import.meta.url), "utf8")
]);

for (const color of ["#0B1117", "#FF6A00", "#7FD8FF", "#F5F7FA"]) {
  assert.ok(css.includes(color), `Missing NORTHBOUND brand color ${color}`);
}
for (const selector of [
  ".season-training-visual-grid",
  ".season-training-ring",
  ".season-training-compare-row",
  "#cockpitTab",
  "#seasonCockpit",
  "#events",
  "#yearOverview",
  "#plannerTab",
  "#historyTab",
  "#seasonTimeline",
  "#seasonRaceCards",
  "#yearCalendar",
  "#northboundRecoveryPlanner",
  "#northboundEventQuality"
]) {
  assert.ok(css.includes(selector), `Missing visual-first treatment: ${selector}`);
}
assert.match(season, /season-training-ring/);
assert.match(season, /Wochenvergleich/);
assert.doesNotMatch(season, /var\(--green\)|var\(--lime\)/,
  "Injected season styles must not reintroduce legacy green/lime variables.");
assert.match(season, /#FF6A00/);
assert.match(season, /#7FD8FF/);

console.log("NORTHBOUND visual-first design system tests passed.");
