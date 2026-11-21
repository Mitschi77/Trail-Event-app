const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const policy = require("../gpx-rights-policy.js");

const raceTools = fs.readFileSync(require.resolve("../race-tools.js"), "utf8");
const marker = "/* Fail-closed GPX rights enforcement.";
const start = raceTools.indexOf(marker);
assert.notEqual(start, -1, "GPX rights gate must be present in race-tools.js");
const gateSource = raceTools.slice(start);

async function harness(entry, gpxUrl = "https://example.org/course.gpx") {
  let originalFetchCalls = 0;
  const route = { id: "test-route", route: "Test route", gpxDownloadUrl: gpxUrl, gpxAvailability: "downloadable" };
  const registry = { schemaVersion: 1, defaultPolicy: "deny", routes: { "test-route": entry } };
  const window = {
    GpxRightsPolicy: policy,
    fetch: async () => {
      originalFetchCalls += 1;
      return { ok: true, json: async () => registry };
    },
    alert: () => {}
  };
  const document = {
    body: {},
    head: { appendChild: () => {} },
    createElement: () => ({}),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  class MutationObserver { observe() {} }
  const context = {
    window,
    document,
    EVENTS: [{ id: "test-event", routes: [route] }],
    eventDataEdits: {},
    routeKey: () => "test-event::test-route",
    queuePlannerCloudSave: () => {},
    localStorage: { setItem: () => {} },
    MutationObserver,
    alert: () => {}
  };
  vm.runInNewContext(gateSource, context);
  await new Promise(resolve => setImmediate(resolve));
  return { window, route, calls: () => originalFetchCalls };
}

(async () => {
  const pending = policy.defaultEntry();
  const blocked = await harness(pending);
  await assert.rejects(blocked.window.fetch("https://example.org/course.gpx"), /GPX/);
  assert.equal(blocked.calls(), 1, "blocked GPX fetch must not reach the original network fetch");
  await blocked.window.fetch("https://example.org/info");
  assert.equal(blocked.calls(), 2, "non-GPX requests must still reach the original fetch");

  const fullPermissions = Object.fromEntries(policy.PROCESS_ACTIONS.map(key => [key, true]));
  const approvedEntry = policy.defaultEntry({
    status: "partial",
    permissions: { ...policy.defaultEntry().permissions, ...fullPermissions },
    restriction: { status: "clear" }
  });
  const approved = await harness(approvedEntry);
  await approved.window.fetch("https://example.org/course.gpx");
  assert.equal(approved.calls(), 2, "explicitly approved GPX fetch may reach the original fetch");
  assert.equal(approved.window.routeGpxIsOrganizerRestricted(approved.route), false);

  const linkOnlyEntry = policy.defaultEntry({
    status: "partial",
    permissions: { ...policy.defaultEntry().permissions, gpxOfficialLink: true },
    restriction: { status: "withheld_until_race_week" }
  });
  const linkOnly = await harness(linkOnlyEntry, "https://example.org/gpx-download");
  assert.equal(linkOnly.window.routeHasDownloadableGpx(linkOnly.route), true, "separate official-page link permission may expose a page link");
  await assert.rejects(linkOnly.window.fetch("https://example.org/gpx-download"), /GPX/);
  assert.equal(linkOnly.calls(), 1, "link-only permission must not allow the app to fetch the GPX page");

  console.log("GPX runtime gate tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
