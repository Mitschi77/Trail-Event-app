import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [css, html] = await Promise.all([
  readFile(new URL("../design-system.css", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8")
]);

const marker = "/* NORTHBOUND · Mobile QA pass 2";
const start = css.lastIndexOf(marker);
assert.notEqual(start, -1, "mobile QA rules must be present");
const mobile = css.slice(start);

assert.match(html, /name=["']viewport["'][^>]*viewport-fit=cover/i,
  "iOS viewport must include safe-area support");
assert.match(mobile, /overflow-x:\s*auto/,
  "wide route and comparison tables must scroll horizontally");
assert.match(mobile, /-webkit-overflow-scrolling:\s*touch/,
  "table scrolling must use native iOS momentum scrolling");
assert.match(mobile, /@media\(max-width:700px\)/,
  "phone layout rules must be present");
assert.match(mobile, /@media\(min-width:701px\)\s+and\s+\(max-width:1100px\)/,
  "tablet layout rules must be present");
assert.match(mobile, /@media\(orientation:landscape\)\s+and\s+\(max-height:500px\)/,
  "short landscape viewports must constrain and scroll dialogs");
assert.match(mobile, /scrollbar-gutter:\s*stable/,
  "scrollable overlays must reserve scrollbar space where supported");
assert.match(mobile, /min-width:\s*0/,
  "responsive grid children must be allowed to shrink");
assert.doesNotMatch(mobile, /green|#[0-9a-f]{3,8}\s*;\s*\/\*\s*green/i,
  "mobile additions must not introduce green styling");

console.log("NORTHBOUND mobile responsive regression tests passed.");
