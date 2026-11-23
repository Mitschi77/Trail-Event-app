import assert from "node:assert/strict";
import { createOwnerTestPushHandler } from "../supabase/functions/send-owner-test-push/core.mjs";

const OWNER = "a5d10e85-e559-4d44-9ee0-d8b8de08262f";
const OTHER = "00000000-0000-4000-8000-000000000001";
const config = { subject: "mailto:push@example.test", public_key: "public-vapid", private_key: "private-vapid" };
const quietLogger = { error() {} };

function harness(options = {}) {
  const state = {
    clients: [],
    rpcCalls: [],
    sessionCalls: [],
    tableCalls: [],
    deleted: [],
    sent: [],
    vapid: null,
    options,
  };
  const envValues = options.envValues ?? {
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_ANON_KEY: "anon-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  };
  const createClient = (url, key, clientOptions) => {
    const client = { url, key, clientOptions };
    state.clients.push(client);
    if (key === envValues.SUPABASE_ANON_KEY) {
      client.auth = { getUser: async () => options.authResult ?? { data: { user: { id: options.userId ?? OWNER } }, error: null } };
      client.rpc = async (name) => {
        state.sessionCalls.push(name);
        if (name !== "is_current_auth_session_active") throw new Error("Unexpected user RPC " + name);
        return options.sessionResult ?? { data: true, error: null };
      };
      return client;
    }
    client.rpc = async (name, args) => {
      state.rpcCalls.push({ name, args });
      if (name === "claim_event_push_rate_limit") return options.rateLimitResult ?? { data: true, error: null };
      if (name === "get_trail_push_vapid_config") return options.configResult ?? { data: config, error: null };
      throw new Error("Unexpected RPC " + name);
    };
    client.from = (table) => {
      const query = { table, operation: "select", filters: [] };
      return {
        select(columns) {
          query.columns = columns;
          return { eq: async (column, value) => {
            query.filters.push([column, value]);
            state.tableCalls.push(query);
            return options.subscriptionResult ?? { data: options.subscriptions ?? [{ id: "sub-1", endpoint: "https://push.test/1", p256dh: "p256dh", auth_secret: "auth" }], error: null };
          }};
        },
        delete() {
          query.operation = "delete";
          return { eq(column, value) {
            query.filters.push([column, value]);
            return { eq: async (secondColumn, secondValue) => {
              query.filters.push([secondColumn, secondValue]);
              state.tableCalls.push(query);
              if (options.deleteError) return { error: options.deleteError };
              state.deleted.push({ id: query.filters[0][1], userId: query.filters[1][1] });
              return { error: null };
            }};
          }};
        },
      };
    };
    return client;
  };
  const webpush = {
    setVapidDetails: (...args) => { state.vapid = args; },
    sendNotification: async (subscription, payload) => {
      state.sent.push({ subscription, payload: JSON.parse(payload) });
      const outcome = options.sendOutcomes?.[state.sent.length - 1] ?? "success";
      if (outcome !== "success") throw Object.assign(new Error("mock push failure"), { statusCode: outcome });
    },
  };
  const handler = createOwnerTestPushHandler({
    env: { get: key => envValues[key] },
    createClient,
    webpush,
    ownerId: OWNER,
    logger: quietLogger,
    now: () => 123456,
  });
  return { handler, state };
}

async function invoke(handler, { method = "POST", authorization = "Bearer test", body = "{}" } = {}) {
  return handler(new Request("https://edge.test/send-owner-test-push", {
    method,
    headers: authorization ? { Authorization: authorization, "Content-Type": "application/json" } : {},
    body: method === "GET" || method === "OPTIONS" ? undefined : body,
  }));
}
async function result(response) { return response.json(); }

{
  const { handler, state } = harness({ authResult: { data: { user: null }, error: { message: "invalid token" } } });
  const response = await invoke(handler);
  assert.equal(response.status, 401);
  assert.equal(state.clients.length, 1, "unauthenticated request must not create a service-role client");
}
{
  const { handler, state } = harness({ sessionResult: { data: false, error: null } });
  const response = await invoke(handler);
  assert.equal(response.status, 401, "a revoked session must not reach privileged operations");
  assert.equal(state.clients.length, 1, "revoked session must not create a service-role client");
}
{
  const { handler, state } = harness({ userId: OTHER });
  const response = await invoke(handler);
  assert.equal(response.status, 403);
  assert.equal(state.clients.length, 1, "non-owner must not reach privileged service-role operations");
}
{
  const { handler } = harness({ rateLimitResult: { data: false, error: null } });
  assert.equal((await invoke(handler)).status, 429);
}
{
  const { handler, state } = harness({ rateLimitResult: { data: null, error: { message: "rpc unavailable" } } });
  assert.equal((await invoke(handler)).status, 503);
  assert.equal(state.rpcCalls.length, 1, "VAPID config must not be read when rate-limit RPC fails");
}
{
  const { handler, state } = harness({ configResult: { data: { public_key: "public", subject: config.subject }, error: null } });
  assert.equal((await invoke(handler)).status, 503, "missing private VAPID key must fail closed");
  assert.equal(state.tableCalls.length, 0, "subscriptions must not be read without complete VAPID config");
}
{
  const { handler } = harness({ envValues: { SUPABASE_URL: "https://supabase.test", SUPABASE_ANON_KEY: "anon-test" } });
  assert.equal((await invoke(handler)).status, 503, "missing server secrets must fail closed");
}
{
  const { handler, state } = harness({ subscriptions: [] });
  const response = await invoke(handler);
  assert.equal(response.status, 200);
  assert.deepEqual(await result(response), { sent: 0, removed: 0, failed: 0, noSubscriptions: true });
  assert.equal(state.sent.length, 0);
}
for (const statusCode of [404, 410]) {
  const { handler, state } = harness({ sendOutcomes: [statusCode] });
  const response = await invoke(handler);
  assert.equal(response.status, 200);
  assert.deepEqual(await result(response), { sent: 0, removed: 1, failed: 0, noSubscriptions: false });
  assert.deepEqual(state.deleted, [{ id: "sub-1", userId: OWNER }]);
}
{
  const { handler, state } = harness({ sendOutcomes: [410], deleteError: { message: "delete denied" } });
  const response = await invoke(handler);
  assert.equal(response.status, 502, "failed cleanup must not be reported as successful");
  assert.deepEqual(await result(response), { sent: 0, removed: 0, failed: 1, noSubscriptions: false });
  assert.deepEqual(state.deleted, []);
}
{
  const { handler } = harness({ sendOutcomes: [500] });
  const response = await invoke(handler);
  assert.equal(response.status, 502);
  assert.deepEqual(await result(response), { sent: 0, removed: 0, failed: 1, noSubscriptions: false });
}
{
  const { handler, state } = harness();
  const response = await invoke(handler, { body: JSON.stringify({ user_id: OTHER, target_user_id: OTHER }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await result(response), { sent: 1, removed: 0, failed: 0, noSubscriptions: false });
  assert.deepEqual(state.rpcCalls[0], { name: "claim_event_push_rate_limit", args: { p_caller_id: OWNER } });
  assert.deepEqual(state.tableCalls[0].filters, [["user_id", OWNER]], "subscription lookup must be hard-bound to the owner");
  assert.deepEqual(state.vapid, [config.subject, config.public_key, config.private_key]);
  assert.equal(state.sent[0].payload.tag, "trail-event-push-test-123456");
}
{
  const { handler } = harness({ subscriptions: [
    { id: "sub-1", endpoint: "https://push.test/1", p256dh: "a", auth_secret: "b" },
    { id: "sub-2", endpoint: "https://push.test/2", p256dh: "c", auth_secret: "d" },
  ], sendOutcomes: [404, 500] });
  const response = await invoke(handler);
  assert.equal(response.status, 502, "mixed expired and failed deliveries must be reported as partial failure");
  assert.deepEqual(await result(response), { sent: 0, removed: 1, failed: 1, noSubscriptions: false });
}
{
  const { handler } = harness();
  assert.equal((await invoke(handler, { method: "GET" })).status, 405);
  assert.equal((await invoke(handler, { method: "OPTIONS" })).status, 200);
}

console.log("Owner push handler: 14 executable security and failure-path checks passed.");
