import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const raceTools = await readFile(new URL("../race-tools.js", import.meta.url), "utf8");
const seasonTools = await readFile(new URL("../season-tools.js", import.meta.url), "utf8");
const appSource = html + "\n" + raceTools + "\n" + seasonTools;
const pushFunction = await readFile(
  new URL("../supabase/functions/send-event-review-push/index.ts", import.meta.url),
  "utf8"
);
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

// Guard against regressions in the functions that exist in the current app.
for (const required of ["importActivityToHistory", "parseCutoffsText", "connectPlannerCloud"]) {
  if (!appSource.includes(required)) throw new Error("Required current app feature is missing: " + required);
}

const appVapidKey = html.match(/const\s+PUSH_VAPID_PUBLIC_KEY\s*=\s*["']([^"']+)["']/)?.[1];
const senderVapidKey = pushFunction.match(/const\s+VAPID_PUBLIC_KEY\s*=\s*["']([^"']+)["']/)?.[1];
if (!appVapidKey || !senderVapidKey) {
  throw new Error("The public VAPID key is missing from the app or push sender.");
}
if (appVapidKey !== senderVapidKey) {
  throw new Error("The app subscription VAPID key does not match the push sender key.");
}

console.log("Validated " + inlineScripts.length + " inline script(s), key app features, and matching Push VAPID keys.");
