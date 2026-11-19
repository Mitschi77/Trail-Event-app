import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
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

if (/id="enableReviewNotifications"[^>]*onclick=/.test(html)) {
  throw new Error("Push setup button must not rely on an inline onclick handler.");
}
if (!html.includes("notify.addEventListener('click',window.trailReviewPushClick)")) {
  throw new Error("Push setup button is not bound through initProposalControls.");
}
if (!html.includes("const task=window.registerReviewPush()")) {
  throw new Error("Push setup must call the registration function synchronously from the click handler.");
}

for (const required of ["parseGpx", "persistGpxData", "connectPlannerCloud"]) {
  if (!html.includes(required)) throw new Error("Required app feature is missing: " + required);
}

if (!html.includes("async function ensureSupabaseLibrary()")) {
  throw new Error("Cloud login must provide a Supabase CDN fallback loader.");
}
if (!html.includes("https://unpkg.com/@supabase/supabase-js@2")) {
  throw new Error("Supabase fallback CDN is missing.");
}
if (!html.includes("if(!(await ensureSupabaseLibrary()))")) {
  throw new Error("Cloud login must wait for the Supabase fallback loader before creating the client.");
}

const signedOutHandler = html.match(/else if\(event==='SIGNED_OUT'\)\{([^}]*)\}/)?.[1] || "";
if (!signedOutHandler.includes("Sitzung beendet.") || signedOutHandler.includes("CLOUD_KEYS.forEach")) {
  throw new Error("Unexpected auth sign-out must preserve local planner data.");
}


if (!html.includes("function plannerAccountBackupKey(userId)")) {
  throw new Error("Account-specific local planner backups are missing.");
}
if (!html.includes("function switchPlannerAccountData(previousUserId,nextUserId)")) {
  throw new Error("Account switching must preserve the previous account snapshot.");
}
const accountSwitch = html.match(/function switchPlannerAccountData\\(previousUserId,nextUserId\\)\\{([\\s\\S]*?)\\nasync function activateCloudUser/)?.[1] || "";
if (!accountSwitch.includes("localStorage.setItem(plannerAccountBackupKey(previousUserId)") || !accountSwitch.includes("validatePlannerSnapshot(nextBackup.keys)") || !accountSwitch.includes("applyPlannerSnapshot(nextBackup.keys)")) {
  throw new Error("Account switching must save, validate, and safely restore account-specific local data.");
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
