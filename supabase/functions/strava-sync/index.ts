import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  decryptToken,
  encryptToken,
  exchangeStravaToken,
  getAdminClient,
  getStravaCredentials,
  json,
  requireUser,
} from "../_shared/strava.ts";

const PAGE_SIZE = 200;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "authentication_required" }, 401);

    const admin = getAdminClient();
    const { data: connection, error: lookupError } = await admin.from("strava_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError) return json({ error: "connection_lookup_failed" }, 500);
    if (!connection) return json({ error: "strava_not_connected" }, 409);

    const { clientId, clientSecret } = getStravaCredentials();
    let accessToken = await decryptToken(
      connection.access_token_ciphertext,
      connection.access_token_iv,
    );
    let refreshToken = await decryptToken(
      connection.refresh_token_ciphertext,
      connection.refresh_token_iv,
    );

    if (Number(connection.expires_at) <= Math.floor(Date.now() / 1000) + 3600) {
      const refreshed = await exchangeStravaToken(new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }));
      if (!refreshed.access_token || !refreshed.refresh_token || !refreshed.expires_at) {
        return json({ error: "token_refresh_incomplete" }, 502);
      }
      accessToken = String(refreshed.access_token);
      refreshToken = String(refreshed.refresh_token);
      const access = await encryptToken(accessToken);
      const refresh = await encryptToken(refreshToken);
      const { error: updateTokenError } = await admin.from("strava_connections").update({
        access_token_ciphertext: access.ciphertext,
        access_token_iv: access.iv,
        refresh_token_ciphertext: refresh.ciphertext,
        refresh_token_iv: refresh.iv,
        expires_at: Number(refreshed.expires_at),
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      if (updateTokenError) return json({ error: "token_rotation_storage_failed" }, 500);
    }

    const headers = { "Authorization": "Bearer " + accessToken };
    const fetchPage = async (params: URLSearchParams) => {
      const response = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?" + params.toString(),
        { headers },
      );
      if (response.status === 401) throw new Error("strava_authorization_revoked");
      if (!response.ok) throw new Error("strava_api_error_" + response.status);
      return await response.json();
    };

    const now = new Date();
    const fetched: any[] = [];
    let historyPage: any[] = [];
    if (connection.last_synced_at) {
      const incremental = new URLSearchParams({ per_page: String(PAGE_SIZE), page: "1" });
      const after = Math.max(0, Math.floor(new Date(connection.last_synced_at).getTime() / 1000) - 259200);
      incremental.set("after", String(after));
      fetched.push(...await fetchPage(incremental));
    }

    if (!connection.history_complete) {
      const history = new URLSearchParams({ per_page: String(PAGE_SIZE), page: "1" });
      if (connection.history_before) history.set("before", String(connection.history_before));
      historyPage = await fetchPage(history);
      fetched.push(...historyPage);
    }

    const unique = new Map<string, any>();
    for (const item of fetched) {
      if (item?.id !== undefined && item?.id !== null) unique.set(String(item.id), item);
    }

    const rows = Array.from(unique.values()).map((item) => ({
      user_id: user.id,
      provider: "strava",
      provider_activity_id: String(item.id),
      name: String(item.name || "Strava activity").slice(0, 200),
      sport_type: String(item.sport_type || item.type || "Other").slice(0, 80),
      started_at: item.start_date ? new Date(item.start_date).toISOString() : null,
      distance_m: Number.isFinite(Number(item.distance)) ? Number(item.distance) : null,
      moving_time_seconds: Number.isFinite(Number(item.moving_time)) ? Math.max(0, Math.round(Number(item.moving_time))) : null,
      elapsed_time_seconds: Number.isFinite(Number(item.elapsed_time)) ? Math.max(0, Math.round(Number(item.elapsed_time))) : null,
      total_elevation_gain_m: Number.isFinite(Number(item.total_elevation_gain)) ? Number(item.total_elevation_gain) : null,
      updated_at: now.toISOString(),
    }));

    if (rows.length) {
      const { error: upsertError } = await admin.from("strava_activities")
        .upsert(rows, { onConflict: "user_id,provider_activity_id" });
      if (upsertError) {
        console.error("Strava activity upsert failed", upsertError.message);
        return json({ error: "activity_import_failed" }, 500);
      }
    }

    let historyBefore = connection.history_before as number | null;
    let historyComplete = Boolean(connection.history_complete);
    if (!historyComplete) {
      if (historyPage.length < PAGE_SIZE) {
        historyComplete = true;
        historyBefore = null;
      } else {
        const oldest = Math.min(...historyPage.map((item) => Math.floor(new Date(item.start_date).getTime() / 1000)).filter(Number.isFinite));
        if (Number.isFinite(oldest)) historyBefore = oldest - 1;
      }
    }

    const { error: cursorError } = await admin.from("strava_connections").update({
      last_synced_at: now.toISOString(),
      history_before: historyBefore,
      history_complete: historyComplete,
      updated_at: now.toISOString(),
    }).eq("user_id", user.id);
    if (cursorError) return json({ error: "sync_cursor_update_failed" }, 500);

    return json({
      imported_or_updated: rows.length,
      history_page_count: historyPage.length,
      history_complete: historyComplete,
      more_history_available: !historyComplete,
      last_synced_at: now.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Strava sync failed", message);
    if (message === "strava_authorization_revoked") return json({ error: "strava_authorization_revoked" }, 401);
    return json({ error: "strava_sync_failed" }, 502);
  }
});
