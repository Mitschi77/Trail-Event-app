const assert = require("node:assert/strict");
const policy = require("../gpx-rights-policy.js");
const registry = require("../gpx-rights.json");
assert.equal(registry.defaultPolicy, "deny", "runtime registry loader must accept the configured deny policy");
assert.equal(registry.routeCount, Object.keys(registry.routes).length, "rights registry route count must match its entries");

const pending = policy.defaultEntry();
assert.equal(policy.canProcess(pending), false, "pending rights must fail closed");
assert.equal(policy.shouldBlockFetch("https://example.org/course.gpx", pending), true, "unapproved GPX fetch must be blocked");
assert.equal(policy.shouldBlockFetch("https://drive.google.com/uc?export=download&id=123", pending), true, "Google Drive direct GPX download must be blocked");
assert.equal(policy.shouldBlockFetch("https://example.org/course", pending), false, "ordinary non-GPX fetches must remain available");

const linkOnly = policy.defaultEntry({
  status: "partial",
  permissions: { ...policy.defaultEntry().permissions, gpxOfficialLink: true },
  restriction: { status: "withheld_until_race_week" }
});
assert.equal(policy.canLink(linkOnly), true, "separate official-page link permission may be granted");
assert.equal(policy.canDownload(linkOnly), false, "link permission must not grant file download");
assert.equal(policy.canProcess(linkOnly), false, "link permission must not grant file processing");

const fullPermissions = Object.fromEntries(policy.PROCESS_ACTIONS.map(key => [key, true]));
const approved = policy.defaultEntry({
  status: "partial",
  permissions: { ...policy.defaultEntry().permissions, ...fullPermissions, gpxFileUserDownload: true },
  restriction: { status: "clear" }
});
assert.equal(policy.canProcess(approved), true, "all explicit permissions plus clear restriction may enable processing");
assert.equal(policy.shouldBlockFetch("https://example.org/course.gpx", approved), false, "explicitly approved current GPX may be fetched");

const withheld = { ...approved, restriction: { status: "withheld_until_race_week" } };
assert.equal(policy.canProcess(withheld), false, "withheld GPX must remain blocked even if permission flags are present");
assert.equal(policy.shouldBlockFetch("https://example.org/course.gpx", withheld), true, "withheld GPX fetch must be blocked");

const incomplete = { ...approved, permissions: { ...approved.permissions, gpxFileMapDisplay: false } };
assert.equal(policy.canProcess(incomplete), false, "missing map-display permission must block the full GPX pipeline");

console.log("GPX rights policy tests passed.");
