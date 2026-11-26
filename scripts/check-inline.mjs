import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const pushFunction = await readFile(
  new URL("../supabase/functions/send-event-review-push/index.ts", import.meta.url),
  "utf8"
);
const ownerTestPushFunction = await readFile(
  new URL("../supabase/functions/send-owner-test-push/index.ts", import.meta.url),
  "utf8"
);
const ownerTestPushCore = await readFile(
  new URL("../supabase/functions/send-owner-test-push/core.mjs", import.meta.url),
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

if (!/id="enableReviewNotifications"[^>]*type="button"/.test(html)) {
  throw new Error("Push setup button is missing or is not a button.");
}
if (!html.includes("button.addEventListener('click',function(event){") ||
    !html.includes("window.trailReviewPushClick(event);")) {
  throw new Error("Push setup button must bind its handler directly to its click event.");
}
if (html.includes("notify.addEventListener('click',window.trailReviewPushClick)")) {
  throw new Error("Push setup must not depend on delayed proposal-control initialization.");
}
if (!html.includes("const task=window.registerReviewPush()")) {
  throw new Error("Push setup must call the registration function synchronously from the click handler.");
}

if (!html.includes("button.textContent=status.textContent.includes('registriert')?'Push ist eingerichtet':'Erneut versuchen'")) {
  throw new Error("Push setup must leave a visible success or retry state on the button.");
}
if (!html.includes("Service Worker wurde nicht rechtzeitig bereit")) {
  throw new Error("Push setup must report a stalled service-worker readiness check.");
}

for (const required of ["parseGpx", "persistGpxData", "connectPlannerCloud"]) {
  if (!html.includes(required)) throw new Error("Required app feature is missing: " + required);
}

if (!html.includes("const PRE_RESTORE_DB_NAME='trail-event-local-backups-v1'") || !html.includes("async function savePreRestoreBackup(backup)") || !html.includes("await savePreRestoreBackup(previous)")) {
  throw new Error("Cloud restore must save the pre-restore snapshot in IndexedDB before replacing local data.");
}
if (!html.includes("async function readPreRestoreBackup()") || !html.includes("backup=await readPreRestoreBackup()") || !html.includes("if(indexedBackup)return indexedBackup;const legacy=localStorage.getItem")) {
  throw new Error("The pre-restore backup export must read the IndexedDB snapshot, with legacy fallback.");
}
const restoreStart = html.indexOf("async function useCloudDataLocally()");
const restoreEnd = html.indexOf("function setCloudProfileIndicator", restoreStart);
const restoreCode = restoreStart >= 0 && restoreEnd > restoreStart ? html.slice(restoreStart, restoreEnd) : "";
if (!restoreCode.includes("await savePreRestoreBackup(previous)") || !restoreCode.includes('recoveryButton.hidden=false') || !restoreCode.includes("preRestoreBackupSaved=true") || !restoreCode.includes("preRestoreBackupSaved||localStorage.getItem") || restoreCode.includes('localStorage.setItem("trailEventPreRestoreBackup"')) {
  throw new Error("Cloud restore must not consume localStorage quota with a second full-size backup.");
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

const logoutStart = html.indexOf("async function clearPersonalDeviceDataAfterLogout()");
const logoutEnd = html.indexOf("async function plannerLogout()", logoutStart);
const logoutCode = logoutStart >= 0 && logoutEnd > logoutStart ? html.slice(logoutStart, logoutEnd) : "";
if (!logoutCode.includes("CLOUD_KEYS") || !logoutCode.includes("trailPlannerAccountBackup_v1_") ||
    !html.includes("async function retryPendingPreRestoreBackupDbDelete()") ||
    !logoutCode.includes("sessionStorage.clear()") || !logoutCode.includes("cloudUser=null")) {
  throw new Error("Explicit logout must clear all personal local stores and account backups.");
}
if (!html.includes("northboundLoggedOut") || !html.includes("event.persisted") ||
    !html.includes("db.onversionchange=()=>db.close()") ||
    !html.includes("northboundLogoutSignal") || !html.includes("new BroadcastChannel('northbound-auth')") ||
    !html.includes("window.addEventListener('storage'")) {
  throw new Error("Logout must prevent private pages from reappearing from the browser back-forward cache.");
}


if (html.includes('<b id="personalUtmbIndex">436</b>') ||
    !html.includes("if(!cloudUser){const index=document.getElementById('personalUtmbIndex')") ||
    !html.includes("Melde dich an, um dein persönliches Saison-Cockpit zu sehen.")) {
  throw new Error("Personal UTMB index and season planning must stay hidden until an authenticated user is active.");
}

if (!html.includes("function plannerAccountBackupKey(userId)")) {
  throw new Error("Account-specific local planner backups are missing.");
}
if (!html.includes("function switchPlannerAccountData(previousUserId,nextUserId)")) {
  throw new Error("Account switching must preserve the previous account snapshot.");
}

for (const required of ["dateCandidate:'Startdatum · Textfund'", "starttimeCandidate:'Startzeit · erkannte Uhrzeit'", "raceCostCandidate:'Startgeld · erkannter Betrag'", "if(Array.isArray(value))return value.filter"]) {
  if (!html.includes(required)) throw new Error("Review queue must render readable official-page candidates: " + required);
}
if (!html.includes("localStorage.setItem(plannerAccountBackupKey(previousUserId)") || !html.includes("validatePlannerSnapshot(nextBackup.keys)") || !html.includes("applyPlannerSnapshot(nextBackup.keys)")) {
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

if (!html.includes('id="sendOwnerPushTest" type="button" onclick="window.trailOwnerPushTestClick(event)"')) {
  throw new Error("Owner push test button must call its handler directly from the click.");
}
if (!html.includes("window.trailOwnerPushTestClick=async function(event)")) {
  throw new Error("Owner push test button handler is missing.");
}
if (!ownerTestPushFunction.includes('from "./core.mjs"') || !ownerTestPushFunction.includes("Deno.serve(handler)")) {
  throw new Error("Owner push Edge Function must serve the independently testable core handler.");
}
for (const required of ["claim_event_push_rate_limit", "get_trail_push_vapid_config", "sendNotification", "event_push_subscriptions", "eq(\"user_id\", ownerId)", "eq(\"user_id\", ownerId)"]) {
  if (!ownerTestPushCore.includes(required)) throw new Error("Owner push core is missing required security behavior: " + required);
}
if (!ownerTestPushCore.includes("config.private_key") || !ownerTestPushCore.includes("webpush.setVapidDetails(config.subject, config.public_key, config.private_key)")) {
  throw new Error("The owner push core must use the private VAPID key only from the secure configuration RPC.");
}
if (ownerTestPushFunction.includes("SUPABASE_SERVICE_ROLE_KEY") || ownerTestPushFunction.includes("private_key") && ownerTestPushFunction.includes("VAPID_PRIVATE_KEY =")) {
  throw new Error("Server secrets must not be hardcoded or passed from the browser.");
}

if (!html.includes("sold-out-stamp") || !html.includes("soldOutRouteBadge(r)")) throw new Error("Sold-out routes must retain their red overview stamp.");
if (!html.includes("const routeData=soldOutRouteBadge(r)+'<div class=\"event-detail-data\">'+row(r,routeKeys)") || !html.includes("group('Geplante Strecke',routeData,true)")) throw new Error("Expanded event details must reuse the shared red sold-out route badge.");
if (!html.includes('data-field="registrationStatus"') || !html.includes("registrationStatus==='sold_out'")) throw new Error("Route editors must persist the available/sold-out registration status.");


const gpxRestriction = html.match(/function routeGpxIsOrganizerRestricted\(route\)\{([^}]*)\}/)?.[1] || "";
if (!gpxRestriction.includes("gpxUseProhibited") || !gpxRestriction.includes("gpxRestricted") || !gpxRestriction.includes("organizer-prohibited")) {
  throw new Error("Organizer GPX restrictions must be recognized across supported restriction fields.");
}
const routeImportStart = html.indexOf("async function importRouteGpx(input)");
const routeImportEnd = html.indexOf("document.addEventListener('change'", routeImportStart);
const routeImport = routeImportStart >= 0 && routeImportEnd > routeImportStart ? html.slice(routeImportStart, routeImportEnd) : "";
if (!routeImport.includes("routeGpxIsOrganizerRestricted(event.routes[ri])") || !routeImport.includes("GPX-Import gesperrt")) {
  throw new Error("Local route GPX import must stop when the organizer prohibits use.");
}
const plannedImportStart = html.indexOf("async function importGpxForRoute(id,ri,input)");
const plannedImportEnd = html.indexOf("function isGpxImportableUrl", plannedImportStart);
const plannedImport = plannedImportStart >= 0 && plannedImportEnd > plannedImportStart ? html.slice(plannedImportStart, plannedImportEnd) : "";
if (!plannedImport.includes("routeGpxIsOrganizerRestricted(route)") || !plannedImport.includes("untersagt die Übernahme")) {
  throw new Error("Planned-route GPX import must enforce organizer restrictions.");
}
const remoteImportStart = html.indexOf("async function importRemoteGpxForRoute");
const remoteImportEnd = html.indexOf("function ", remoteImportStart + 20);
const remoteImport = remoteImportStart >= 0 ? html.slice(remoteImportStart, remoteImportEnd > remoteImportStart ? remoteImportEnd : remoteImportStart + 1800) : "";
if (!remoteImport.includes("routeGpxIsOrganizerRestricted(route)") || !remoteImport.includes("untersagt die Übernahme")) {
  throw new Error("Remote GPX import must enforce organizer restrictions.");
}
const supabaseLoaderStart = html.indexOf("async function ensureSupabaseLibrary()");
const supabaseLoaderEnd = html.indexOf("async function connectPlannerCloud()", supabaseLoaderStart);
const supabaseLoader = supabaseLoaderStart >= 0 && supabaseLoaderEnd > supabaseLoaderStart ? html.slice(supabaseLoaderStart, supabaseLoaderEnd) : "";
if (!supabaseLoader.includes("https://unpkg.com/@supabase/supabase-js@2") || !supabaseLoader.includes("12000") || !supabaseLoader.includes("window.supabase?.createClient")) {
  throw new Error("Cloud login must retry loading the Supabase client library with a bounded timeout.");
}

console.log("Validated " + inlineScripts.length + " inline script(s), key app features, sold-out status UI, and matching Push VAPID keys.");
