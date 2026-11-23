import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

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

console.log('Single-active-device app integration tests passed.');
