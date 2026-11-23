import assert from 'node:assert/strict';

const baseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(baseUrl && anonKey && serviceKey, 'Local Supabase URL and keys are required.');

async function api(path, { token, key = anonKey, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data, text };
}
function decodeJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}
async function requireOk(result, label) {
  assert.ok(result.response.ok, `${label}: HTTP ${result.response.status}: ${result.text}`);
  return result.data;
}
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `session-e2e-${suffix}@example.test`;
const password = `Trail-Test-${suffix}-Aa9!`;

const created = await requireOk(await api('/auth/v1/admin/users', {
  token: serviceKey, key: serviceKey, method: 'POST',
  body: { email, password, email_confirm: true },
}), 'Create isolated test user');
const userId = created.id;
assert.ok(userId, 'Auth admin must return the new user id.');

async function passwordLogin(device) {
  return requireOk(await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  }), `Password login ${device}`);
}
const deviceA = await passwordLogin('iPhone');
const deviceB = await passwordLogin('iPad');
const claimsA = decodeJwt(deviceA.access_token);
const claimsB = decodeJwt(deviceB.access_token);
assert.equal(claimsA.sub, userId);
assert.equal(claimsB.sub, userId);
assert.ok(claimsA.session_id, 'First Auth JWT must carry session_id.');
assert.ok(claimsB.session_id, 'Second Auth JWT must carry session_id.');
assert.notEqual(claimsA.session_id, claimsB.session_id, 'Each device login must create a distinct Auth session.');

async function rpc(token) {
  const result = await api('/rest/v1/rpc/is_current_auth_session_active', {
    token, method: 'POST', body: {},
  });
  await requireOk(result, 'Session status RPC');
  return result.data;
}
assert.equal(await rpc(deviceA.access_token), true, 'iPhone session must initially be active.');
assert.equal(await rpc(deviceB.access_token), true, 'iPad session must initially be active.');

async function serviceInsert(table, row) {
  await requireOk(await api(`/rest/v1/${table}`, {
    token: serviceKey, key: serviceKey, method: 'POST', body: row,
    headers: { Prefer: 'return=minimal' },
  }), `Seed ${table}`);
}
await serviceInsert('planner_data', { user_id: userId, data: { source: 'local-auth-e2e' } });
await serviceInsert('event_push_subscriptions', { user_id: userId });
await serviceInsert('event_change_proposals', { submitted_by: userId, status: 'pending' });
// Seed a private file through Storage's HTTP API using the local service-role key.
const upload = await fetch(new URL(`/storage/v1/object/trail-private-documents/${userId}/session-test.txt`, baseUrl), {
  method: 'POST',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'text/plain', 'x-upsert': 'true' },
  body: 'session-e2e',
});
assert.ok(upload.ok, `Seed private document: HTTP ${upload.status}: ${await upload.text()}`);

async function rows(table, token) {
  return requireOk(await api(`/rest/v1/${table}?select=*&limit=5`, { token }), `Read ${table}`);
}
assert.equal((await rows('planner_data', deviceA.access_token)).length, 1);
assert.equal((await rows('event_push_subscriptions', deviceA.access_token)).length, 1);
assert.equal((await rows('event_change_proposals', deviceA.access_token)).length, 1);
const storageBefore = await fetch(new URL(`/storage/v1/object/authenticated/trail-private-documents/${userId}/session-test.txt`, baseUrl), {
  headers: { apikey: anonKey, Authorization: `Bearer ${deviceA.access_token}` },
});
assert.equal(storageBefore.status, 200, 'Active iPhone session must read its private file.');

const revoked = await api('/auth/v1/logout?scope=others', {
  token: deviceB.access_token, method: 'POST',
});
await requireOk(revoked, 'Sign out other sessions from the iPad');
assert.equal(await rpc(deviceB.access_token), true, 'Current iPad session must remain active.');
assert.equal(await rpc(deviceA.access_token), false, 'Old iPhone JWT must be rejected by the live session RPC.');
assert.equal((await rows('planner_data', deviceA.access_token)).length, 0, 'Revoked iPhone must not read planner data.');
assert.equal((await rows('event_push_subscriptions', deviceA.access_token)).length, 0, 'Revoked iPhone must not read push subscriptions.');
assert.equal((await rows('event_change_proposals', deviceA.access_token)).length, 0, 'Revoked iPhone must not read proposals.');
const storageAfter = await fetch(new URL(`/storage/v1/object/authenticated/trail-private-documents/${userId}/session-test.txt`, baseUrl), {
  headers: { apikey: anonKey, Authorization: `Bearer ${deviceA.access_token}` },
});
assert.notEqual(storageAfter.status, 200, 'Revoked iPhone must not read its private file.');

const oldRefresh = await api('/auth/v1/token?grant_type=refresh_token', {
  method: 'POST', body: { refresh_token: deviceA.refresh_token },
});
assert.ok(!oldRefresh.response.ok, 'Revoked iPhone refresh token must no longer work.');
const currentRefresh = await requireOk(await api('/auth/v1/token?grant_type=refresh_token', {
  method: 'POST', body: { refresh_token: deviceB.refresh_token },
}), 'Current iPad refresh token must remain valid');
assert.ok(currentRefresh.access_token, 'Current iPad must receive a refreshed access token.');
assert.equal(await rpc(currentRefresh.access_token), true, 'Refreshed iPad session must remain active.');

console.log('Real local Supabase Auth session revocation and RLS E2E test passed.');
