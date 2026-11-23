const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const policy = require("../gpx-rights-policy.js");

const raceTools = fs.readFileSync(require.resolve("../race-tools.js"), "utf8");
const marker = "/* Fail-closed GPX rights enforcement.";
const start = raceTools.indexOf(marker);
assert.notEqual(start, -1, "GPX rights gate must be present");
const gateSource = raceTools.slice(start);

async function harness(registry, routeUrl = "https://example.org/course.gpx", withStoredData = true) {
  let networkCalls = 0, mapCalls = 0, persistCalls = 0, remoteCalls = 0, localRouteImports = 0, indexedRouteImports = 0, localWrites = 0, cloudSaves = 0, activityImports = 0;
  const route = { id: "test-route", route: "Test route", gpxDownloadUrl: routeUrl, gpxAvailability: "downloadable" };
  if (withStoredData) {
    route.gpxTrack = [{ lat: 45, lon: 13 }];
    route.gpxFileName = "course.gpx";
    route.gpxDistanceKm = 10;
    route.gpxAscentHm = 500;
    route.elevationProfile = [100, 200, 300];
    route.profileSource = "Streckendatei: course.gpx";
  }
  const window = {
    GpxRightsPolicy: policy,
    fetch: async () => { networkCalls++; return { ok: true, json: async () => registry }; },
    alert: () => {},
    renderGpxMap: () => { mapCalls++; return "MAP_RENDERED"; },
    initGpxMap: () => { mapCalls++; },
    persistGpxData: () => { persistCalls++; },
    importRouteGpx: async () => { localRouteImports++; },
    importGpxForRoute: async () => { indexedRouteImports++; },
    importRemoteGpxForRoute: async () => { remoteCalls++; },
    importActivityFile: async () => { activityImports++; return "ACTIVITY_IMPORTED"; },
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
    window, document,
    EVENTS: [{ id: "test-event", routes: [route, { id: "unlisted-route", route: "Unlisted", gpxDownloadUrl: "https://example.org/legacy.gpx" }] }],
    eventDataEdits,
    routeKey: () => "test-event::test-route",
    queuePlannerCloudSave: () => { cloudSaves++; },
    localStorage: { setItem: () => { localWrites++; } },
    MutationObserver,
    alert: () => {}
  };
  vm.runInNewContext(gateSource, context);
  await new Promise(resolve => setImmediate(resolve));
  return {
    window, route, unlistedRoute: context.EVENTS[0].routes[1], eventDataEdits,
    networkCalls: () => networkCalls, mapCalls: () => mapCalls, persistCalls: () => persistCalls,
    remoteCalls: () => remoteCalls, localRouteImports: () => localRouteImports, indexedRouteImports: () => indexedRouteImports,
    localWrites: () => localWrites, cloudSaves: () => cloudSaves, activityImports: () => activityImports
  };
}

(async () => {
  const pending = await harness({ schemaVersion: 1, defaultPolicy: "deny", routes: {} });
  await assert.rejects(pending.window.fetch("https://example.org/course.gpx"), /GPX/);
  assert.equal(pending.networkCalls(), 1, "blocked GPX must not reach network; only registry request is counted");
  await pending.window.fetch("https://example.org/info");
  assert.equal(pending.networkCalls(), 2, "non-GPX fetch remains available");
  assert.match(pending.window.renderGpxMap(pending.route), /GPX/);
  assert.equal(pending.mapCalls(), 0);
  assert.throws(() => pending.window.persistGpxData(pending.route), /GPX/);
  assert.equal(pending.persistCalls(), 0);
  assert.equal(pending.window.routeGpxIsOrganizerRestricted(pending.route), true);
  assert.equal(pending.window.routeHasDownloadableGpx(pending.route), false);
  assert.equal(pending.window.routeHasOfficialGpxPageLink(pending.route), false);

  const status = { textContent: "" };
  const localInput = {
    dataset: { gpxEvent: "test-event", gpxRoute: "test-route" },
    value: "selected.gpx",
    closest: () => ({ querySelector: () => status })
  };
  await pending.window.importRouteGpx(localInput);
  assert.equal(pending.localRouteImports(), 0, "blocked local route import must not call the importer");
  assert.equal(localInput.value, "", "blocked local route import must clear the selected file input");
  assert.match(status.textContent, /GPX/);

  const indexedInput = { value: "selected.gpx" };
  await pending.window.importGpxForRoute(0, 0, indexedInput);
  assert.equal(pending.indexedRouteImports(), 0, "blocked indexed route import must not call the importer");
  assert.equal(indexedInput.value, "");

  const remoteButton = { disabled: false, textContent: "GPX laden" };
  await pending.window.importRemoteGpxForRoute(0, 0, "https://example.org/course.gpx", remoteButton);
  assert.equal(pending.remoteCalls(), 0, "blocked remote route import must not reach the importer");
  assert.equal(remoteButton.disabled, true);
  assert.equal(remoteButton.textContent, "GPX gesperrt");
  assert.equal(pending.window.proposalGpxIsRestricted({ eventId: "test-event", routeId: "test-route" }), true);
  assert.equal(pending.window.reviewGpxUrl({ eventId: "test-event", routeId: "test-route" }), "");
  assert.deepEqual(pending.route.gpxTrack, [{ lat: 45, lon: 13 }], "existing in-memory GPX must be retained");
  assert.deepEqual(pending.route.elevationProfile, [100, 200, 300], "existing profile must be retained");
  assert.deepEqual(pending.eventDataEdits["test-event::test-route"].gpxTrack, [{ lat: 45, lon: 13 }], "stored GPX edit must be retained");
  assert.equal(pending.localWrites(), 0, "rights checks must not rewrite local data");
  assert.equal(pending.cloudSaves(), 0, "rights checks must not queue cloud saves");
  assert.equal(pending.window.routeGpxIsOrganizerRestricted(pending.unlistedRoute), true, "unlisted organizer routes must also fail closed");
  assert.match(pending.window.renderGpxMap(pending.unlistedRoute), /GPX/);
  assert.equal(pending.mapCalls(), 0);

  const activity = await pending.window.importActivityFile({ name: "personal-run.gpx" });
  assert.equal(activity, "ACTIVITY_IMPORTED", "personal activity import must remain separate from organizer-course GPX rights");
  assert.equal(pending.activityImports(), 1);

  const linkOnlyEntry = policy.defaultEntry({
    status: "partial",
    permissions: { ...policy.defaultEntry().permissions, gpxOfficialLink: true },
    restriction: { status: "not_checked" }
  });
  const linkOnly = await harness({ schemaVersion: 1, defaultPolicy: "deny", routes: { "test-route": linkOnlyEntry } }, "https://example.org/course-info");
  assert.equal(linkOnly.window.routeHasDownloadableGpx(linkOnly.route), false, "page-link permission must not be reported as file-download permission");
  assert.equal(linkOnly.window.routeHasOfficialGpxPageLink(linkOnly.route), true, "separately approved official page link may be shown");
  await assert.rejects(linkOnly.window.fetch("https://example.org/course-info"), /GPX/);
  assert.equal(linkOnly.networkCalls(), 1, "link-only permission must not allow app fetch");
  assert.equal(linkOnly.window.routeGpxIsOrganizerRestricted(linkOnly.route), true);

  const fullPermissions = Object.fromEntries(policy.PROCESS_ACTIONS.map(key => [key, true]));
  const approvedEntry = policy.defaultEntry({
    status: "approved",
    permissions: { ...policy.defaultEntry().permissions, ...fullPermissions, gpxFileUserDownload: true, gpxOfficialLink: true },
    restriction: { status: "clear" }
  });
  const approved = await harness({ schemaVersion: 1, defaultPolicy: "deny", routes: { "test-route": approvedEntry } });
  await approved.window.fetch("https://example.org/course.gpx");
  assert.equal(approved.networkCalls(), 2, "explicitly approved GPX fetch may reach network");
  assert.equal(approved.window.routeGpxIsOrganizerRestricted(approved.route), false);
  assert.equal(approved.window.routeHasDownloadableGpx(approved.route), true, "approved direct GPX file may be offered for download");
  assert.equal(approved.window.routeHasOfficialGpxPageLink(approved.route), false, "direct file URL is not a page-only link");
  assert.equal(approved.window.renderGpxMap(approved.route), "MAP_RENDERED");
  assert.equal(approved.mapCalls(), 1);
  approved.window.persistGpxData(approved.route);
  assert.equal(approved.persistCalls(), 1);

  const restrictedEntry = policy.defaultEntry({
    status: "approved",
    permissions: { ...policy.defaultEntry().permissions, ...fullPermissions, gpxFileUserDownload: true, gpxOfficialLink: true },
    restriction: { status: "withheld_until_race_week" }
  });
  const restricted = await harness({ schemaVersion: 1, defaultPolicy: "deny", routes: { "test-route": restrictedEntry } });
  await assert.rejects(restricted.window.fetch("https://example.org/course.gpx"), /GPX/);
  assert.equal(restricted.networkCalls(), 1, "restriction must block before network");
  assert.equal(restricted.window.routeGpxIsOrganizerRestricted(restricted.route), true);

  console.log("GPX runtime gate tests passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
