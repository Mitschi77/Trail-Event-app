import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const htmlClosings = [...html.matchAll(new RegExp("</html>", "gi"))];
const bodyClosings = [...html.matchAll(new RegExp("</body>", "gi"))];
if (htmlClosings.length !== 1 || bodyClosings.length !== 1) {
  throw new Error("index.html must contain exactly one closing body and html tag.");
}
if (html.slice(htmlClosings[0].index + htmlClosings[0][0].length).trim()) {
  throw new Error("Unexpected content found after the closing html tag.");
}
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1].trim())
  .filter(Boolean);

if (inlineScripts.length === 0) {
  throw new Error("No inline application scripts found.");
}

for (const [index, source] of inlineScripts.entries()) {
  try {
    new Function(source);
  } catch (error) {
    throw new Error("Inline script " + (index + 1) + " has a syntax error: " + error.message);
  }
}

for (const required of ["parseGpx", "persistGpxData", "connectPlannerCloud"]) {
  if (!html.includes(required)) throw new Error("Required app feature is missing: " + required);
}

console.log("Validated " + inlineScripts.length + " inline script(s) and key app features.");
