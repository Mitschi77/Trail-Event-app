import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
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
