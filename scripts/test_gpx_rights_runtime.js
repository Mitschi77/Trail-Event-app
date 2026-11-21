const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const policy = require("../gpx-rights-policy.js");

const raceTools = fs.readFileSync(require.resolve("../race-tools.js"), "utf8");
const marker = "/* Fail-closed GPX rights enforcement.";
const start = raceTools.indexOf(marker);
assert.notEqual(start, -1, "GPX rights gate must be present in race-tools.js");
const gateSource = raceTools.slice(start);

async function harness(entry, gpxUrl = "https://example.org/course.gpx", withStoredData = false, registryFetchFails = false) {
  let originalFetchCalls = 0;
  let mapCalls = 0;
  let persistCalls = 0;
  let remoteImportCalls = 0;
  let localWrites = 0;
  let cloudSaves = 0;
  const route = {
    id: "explorer-85-2993",
    route: "Test route",
    gpxDownloadUrl: gpxUrl,
    gpxAvailability: "downloadable"
  };
  if (withStoredData) {
    route.gpxTrack = [{ lat: 45, lon: 13 }];
    route.gpxFileName = "course.gpx";
    route.gpxDistanceKm = 10;
    route.gpxAscentHm = 500;
    route.elevationProfile = [100, 200, 300];
    route.profileSource = "Streckendatei: course.gpx";
  }
  const registry = { schemaVersion: 1, defaultPolicy: "deny", routes: { "explorer-85-2993": entry, "explorer-85-2993": entry } };
  const window = {
    GpxRightsPolicy: policy,
    fetch: async (url) => {
      originalFetchCalls += 1;
      if (registryFetchFails && String(url).includes("gpx-rights.json")) return { ok: false, status: 503 };
      return { ok: true, json: async () => registry };
    },
    alert: () => {},
    renderGpxMap: () => { mapCalls += 1; return "MAP_RENDERED"; },
    initGpxMap: () => { mapCalls += 1; },
    persistGpxData: () => { persistCalls += 1; },
    importRemoteGpxForRoute: async () => { remoteImportCalls += 1; },
    proposalGpxIsRestricted: () => false,
    reviewGpxUrl: () => "https://example.org/course.gpx"
  };
  const document = {
    body: {},
    head: { appendChild: () => {} },
    createElement: () => ({}),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  class MutationObserver { observe() {} }
  const eventDataEdits = withStoredData ? {
    "test-event::test-route": {
      gpxTrack: [{ lat: 45, lon: 13 }],
      gpxFileName: "course.gpx",
      gpxDistanceKm: 10,
      gpxAscentHm: 500,
      elevationProfile: [100, 200, 300],
      profileSource: "Streckendatei: course.gpx"
    }
  } : {};
  const context = {
    window,
    document,
    EVENTS: [{ id: "test-event", routes: [route, { id: "legacy-route", route: "Unlisted legacy route", gpxDownloadUrl: "https://example.org/legacy.gpx" }] }],
    eventDataEdits,
    routeKey: () => "test-event::test-route",
    queuePlannerCloudSave: () => { cloudSaves += 1; },
    localStorage: { setItem: () => { localWrites += 1; } },
    MutationObserver,
    alert: () => {}
  };
  vm.runInNewContext(gateSource, context);
  await new Promise(resolve => setImmediate(resolve));
  return {
    window, route, legacyRoute: context.EVENTS[0].routes[1], eventDataEdits,
    calls: () => originalFetchCalls,
    mapCalls: () => mapCalls,
    persistCalls: () => persistCalls,
    remoteImportCalls: () => remoteImportCalls,
    localWrites: () => localWrites,
    cloudSaves: () => cloudSaves
  };
}

(async () => {
  const pending = await harness(policy.defaultEntry(), "https://example.org/course.gpx", true);
  await assert.rejects(pending.window.fetch("https://example.org/course.gpx"), /GPX/);
  assert.equal(pending.calls(), 1, "blocked GPX fetch must not reach the original network fetch");
  await pending.window.fetch("https://example.org/info");
  assert.equal(pending.calls(), 2, "non-GPX requests must still reach the original fetch");
  assert.match(pending.window.renderGpxMap(pending.route), /GPX/);
  assert.equal(pending.mapCalls(), 0, "blocked route must not render a GPX map");
  assert.throws(() => pending.window.persistGpxData(pending.route), /GPX/);
  assert.equal(pending.persistCalls(), 0, "blocked route must not persist GPX data");
  assert.equal(pending.window.routeGpxIsOrganizerRestricted(pending.route), true);
  const registeredButMissing = { id: "bora-ultra-105-3837", gpxDownloadUrl: "https://example.org/missing.gpx" };
  assert.equal(pending.window.routeGpxIsOrganizerRestricted(registeredButMissing), true, "registered route missing a registry entry must fail closed");
  assert.equal(pending.window.gpxRightsAllows("bora-ultra-105-3837", "gpxFileFetch"), false, "missing registered rights entry must never inherit legacy permission");
  assert.equal(pending.window.proposalGpxIsRestricted({ eventId: "test-event", routeId: "explorer-85-2993" }), true);
  assert.equal(pending.window.reviewGpxUrl({ eventId: "test-event", routeId: "explorer-85-2993" }), "");
  assert.deepEqual(pending.route.gpxTrack, [{ lat: 45, lon: 13 }], "existing in-memory GPX track must be retained");
  assert.deepEqual(pending.route.elevationProfile, [100, 200, 300], "existing GPX-derived elevation profile must be retained");
  assert.deepEqual(pending.eventDataEdits["test-event::test-route"].gpxTrack, [{ lat: 45, lon: 13 }], "existing stored GPX edit must be retained");
  assert.equal(pending.localWrites(), 0, "rights checks must not rewrite or erase local planner data");
  assert.equal(pending.cloudSaves(), 0, "rights checks must not queue destructive cloud synchronization");
  assert.equal(pending.window.routeGpxIsOrganizerRestricted(pending.legacyRoute), false, "unlisted routes must retain legacy GPX behavior");
  assert.equal(pending.window.renderGpxMap(pending.legacyRoute), "MAP_RENDERED", "unlisted routes must retain their existing GPX map behavior");
  assert.equal(pending.mapCalls(), 1, "unlisted route map rendering must remain available");
  assert.equal(pending.window.routeHasDownloadableGpx(pending.legacyRoute), true, "unlisted route download links must retain legacy behavior");
  await pending.window.fetch("https://example.org/legacy.gpx");
  assert.equal(pending.calls(), 3, "unlisted route GPX fetch must retain legacy network behavior");
  assert.equal(pending.window.isGpxImportableUrl("https://example.org/legacy.gpx", "verified"), true, "unlisted route GPX importability must retain legacy behavior");

  const fullPermissions = Object.fromEntries(policy.PROCESS_ACTIONS.map(key => [key, true]));
  const approvedEntry = policy.defaultEntry({
    status: "partial",
    permissions: { ...policy.defaultEntry().permissions, ...fullPermissions, gpxFileUserDownload: true },
    restriction: { status: "clear" }
  });
  const approved = await harness(approvedEntry);
  await approved.window.fetch("https://example.org/course.gpx");
  assert.equal(approved.calls(), 2, "explicitly approved GPX fetch may reach the original fetch");
  assert.equal(approved.window.routeGpxIsOrganizerRestricted(approved.route), false);
  assert.equal(approved.window.renderGpxMap(approved.route), "MAP_RENDERED");
  assert.equal(approved.mapCalls(), 1, "approved route may render its GPX map");
  approved.window.persistGpxData(approved.route);
  assert.equal(approved.persistCalls(), 1, "approved route may persist GPX data");

  const linkOnlyEntry = policy.defaultEntry({
    status: "partial",
    permissions: { ...policy.defaultEntry().permissions, gpxOfficialLink: true },
    restriction: { status: "withheld_until_race_week" }
  });
  const linkOnly = await harness(linkOnlyEntry, "https://example.org/gpx-download");
  assert.equal(linkOnly.window.routeHasDownloadableGpx(linkOnly.route), true, "separate official-page link permission may expose a page link");
  await assert.rejects(linkOnly.window.fetch("https://example.org/gpx-download"), /GPX/);
  assert.equal(linkOnly.calls(), 1, "link-only permission must not allow the app to fetch the GPX page");
  assert.equal(linkOnly.window.routeGpxIsOrganizerRestricted(linkOnly.route), true);

  const legacyWithoutRegistry = await harness(policy.defaultEntry(), "https://example.org/legacy-fallback.gpx", false, true);
  assert.equal(legacyWithoutRegistry.window.routeGpxIsOrganizerRestricted(legacyWithoutRegistry.legacyRoute), false, "registry failure must not extend organizer restrictions to unlisted routes");
  await legacyWithoutRegistry.window.fetch("https://example.org/legacy.gpx");
  assert.equal(legacyWithoutRegistry.calls(), 2, "unlisted route GPX fetch must keep legacy behavior even if the scoped registry cannot load");

  console.log("GPX runtime gate tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
