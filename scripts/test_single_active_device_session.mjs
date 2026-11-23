import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.doesNotMatch(
  html,
  /auth\.signOut\(\s*\)/,
  'Every logout path must be scoped explicitly; a bare signOut would revoke every device.'
);
assert.match(
  html,
  /auth\.signOut\(\{scope:'local'\}\)/,
  'Aborting account transfer or logging out must only end the current device session.'
);
const explicitLogin = html.match(/async function plannerLogin\(e\)\{[\s\S]*?(?=\nasync function plannerLoginClick)/)?.[0] || '';
assert.match(
  explicitLogin,
  /auth\.signOut\(\{scope:'others'\}\)/,
  'Only an explicit password login may revoke other devices.'
);
const cloudRestore = html.match(/async function connectPlannerCloud\(\)[\s\S]*?(?=\nfunction plannerAccountBackupKey)/)?.[0] || '';
assert.ok(cloudRestore, 'Cloud restore function must remain discoverable for the session safety test.');
assert.doesNotMatch(
  cloudRestore,
  /scope:'others'/,
  'Restoring a persisted session must never revoke a newer device login.'
);
const localLogout = html.match(/async function plannerLogout\(\)[\s\S]*?(?=\nconst originalLocalGetItem)/)?.[0] || '';
assert.match(
  localLogout,
  /auth\.signOut\(\{scope:'local'\}\)/,
  'Manual logout must only end the current device session.'
);

assert.match(
  html,
  /auth\.signOut\(\{scope:'others'\}\)/,
  'A successful explicit password login must revoke other Auth sessions.'
);
assert.match(
  html,
  /Andere Gerätesitzungen konnten nicht sicher beendet werden/,
  'A failed revocation must abort the new login.'
);
assert.match(
  html,
  /if\(window\.plannerCloudCheckTimer\)\{clearInterval\(window\.plannerCloudCheckTimer\);window\.plannerCloudCheckTimer=null;\}/,
  'A signed-out device must stop its cloud polling interval.'
);
assert.match(
  html,
  /Sitzung beendet oder auf einem anderen Gerät abgemeldet/,
  'The user must be told why cloud sync stopped.'
);
assert.match(
  html,
  /async function activateCloudUser\(user\)\{const \{data:activeSession,error:sessionError\}=await cloudClient\.rpc\('is_current_auth_session_active'\)/,
  'A persisted old session must be checked before loading cloud data.'
);
assert.match(
  html,
  /if\(cloudBusy\|\|document\.hidden\)return;try\{const \{data:activeSession,error:sessionError\}=await cloudClient\.rpc\('is_current_auth_session_active'\)/,
  'A logged-in device must recheck session ownership during cloud polling.'
);

const edgeFunctions = [
  ['send-event-review-push', '../supabase/functions/send-event-review-push/index.ts'],
  ['delete-own-account', '../supabase/functions/delete-own-account/index.ts'],
  ['migrate-personal-documents', '../supabase/functions/migrate-personal-documents/index.ts'],
  ['send-owner-test-push', '../supabase/functions/send-owner-test-push/core.mjs'],
];

for (const [name, relativePath] of edgeFunctions) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  assert.match(
    source,
    /rpc\(["']is_current_auth_session_active["']\)/,
    name + ' must validate the caller session before privileged work.'
  );
  assert.match(
    source,
    /activeSession !== true/,
    name + ' must reject a revoked or unverifiable session.'
  );
}

const reviewPush = fs.readFileSync(
  new URL('../supabase/functions/send-event-review-push/index.ts', import.meta.url),
  'utf8'
);
assert.match(
  reviewPush,
  /if \(!internalCall\) \{[\s\S]*?rpc\(["']is_current_auth_session_active["']\)[\s\S]*?activeSession !== true/,
  'Review push must check user sessions while retaining its trusted server-to-server path.'
);

console.log('Single-active-device app integration tests passed.');
