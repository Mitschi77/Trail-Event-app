const assert = require("node:assert/strict");
const policy = require("../gpx-rights-policy.js");
const registry = require("../gpx-rights.json");

assert.equal(registry.defaultPolicy, "deny");
assert.equal(registry.routeCount, Object.keys(registry.routes).length);
assert.equal(registry.unlistedRoutePolicy, "deny");

const pending = policy.defaultEntry();
assert.equal(policy.canProcess(pending), false);
assert.equal(policy.shouldBlockFetch("https://example.org/course.gpx", pending), true);
assert.equal(policy.shouldBlockFetch("https://drive.google.com/uc?export=download&id=123", pending), true);
assert.equal(policy.shouldBlockFetch("https://example.org/info", pending), false);

const unlisted = registry.routes["route-not-listed"] || policy.defaultEntry();
assert.equal(policy.canProcess(unlisted), false, "unlisted route must fail closed");

const linkOnly = policy.defaultEntry({
  status: "partial",
  permissions: { ...policy.defaultEntry().permissions, gpxOfficialLink: true },
  restriction: { status: "not_checked" }
});
assert.equal(policy.canLink(linkOnly), false, "link permission alone must not bypass an unchecked restriction register");
assert.equal(policy.canDownload(linkOnly), false);
assert.equal(policy.canProcess(linkOnly), false);
assert.equal(policy.shouldBlockFetch("https://example.org/course-info", linkOnly, true), true);
const linkExplicitlyAllowedDespiteFileRestriction = {
  ...linkOnly,
  restriction: { status: "restricted", linkStatus: "allowed" }
};
assert.equal(policy.canLink(linkExplicitlyAllowedDespiteFileRestriction), true, "a separately documented explicit link allowance may survive a file restriction");
assert.equal(policy.canProcess(linkExplicitlyAllowedDespiteFileRestriction), false, "link allowance must never authorize GPX file processing");
const linkProhibited = {
  ...linkOnly,
  restriction: { status: "restricted", linkStatus: "prohibited" }
};
assert.equal(policy.canLink(linkProhibited), false, "a link prohibition must override the link permission flag");

const fullPermissions = Object.fromEntries(policy.PROCESS_ACTIONS.map(key => [key, true]));
const approved = policy.defaultEntry({
  status: "approved",
  permissions: { ...policy.defaultEntry().permissions, ...fullPermissions, gpxFileUserDownload: true, gpxOfficialLink: true },
  restriction: { status: "clear" }
});
assert.equal(policy.canProcess(approved), true);
assert.equal(policy.shouldBlockFetch("https://example.org/course.gpx", approved), false);
assert.equal(policy.canDownload(approved), true);

const withheld = { ...approved, restriction: { status: "withheld_until_race_week" } };
assert.equal(policy.canProcess(withheld), false);
assert.equal(policy.shouldBlockFetch("https://example.org/course.gpx", withheld), true);

const missingMapPermission = { ...approved, permissions: { ...approved.permissions, gpxFileMapDisplay: false } };
assert.equal(policy.canProcess(missingMapPermission), false);

console.log("GPX rights policy tests passed.");
