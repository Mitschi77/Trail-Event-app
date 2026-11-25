import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  decryptToken,
  getAdminClient,
  getStravaCredentials,
  json,
  randomState,
  requireUser,
  sha256Hex,
  getSupabaseUrl,
} from "../_shared/strava.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "authentication_required" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const admin = getAdminClient();

    if (action === "start") {
      const { clientId } = getStravaCredentials();
      const state = randomState();
      const stateHash = await sha256Hex(state);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error } = await admin.from("strava_oauth_states").insert({
        state_hash: stateHash,
        user_id: user.id,
        expires_at: expiresAt,
      });
      if (error) {
        console.error("Strava OAuth state insert failed", error.message);
        return json({ error: "oauth_initialization_failed" }, 500);
      }

      const redirectUri = getSupabaseUrl() + "/functions/v1/strava-callback";
      const authorize = new URL("https://www.strava.com/oauth/authorize");
      authorize.searchParams.set("client_id", clientId);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("redirect_uri", redirectUri);
      authorize.searchParams.set("approval_prompt", "auto");
      authorize.searchParams.set("scope", "read,activity:read_all");
      authorize.searchParams.set("state", state);

      return json({ authorization_url: authorize.toString(), expires_in: 600 });
    }

    if (action === "status") {
      const { data, error } = await admin.from("strava_connections")
        .select("athlete_id, scope, connected_at, last_synced_at, history_complete")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return json({ error: "connection_status_unavailable" }, 500);
      return json({
        connected: Boolean(data),
        athlete_id: data?.athlete_id ?? null,
        scope: data?.scope ?? null,
        connected_at: data?.connected_at ?? null,
        last_synced_at: data?.last_synced_at ?? null,
        history_complete: data?.history_complete ?? false,
      });
    }

    if (action === "disconnect") {
      const { clientId, clientSecret } = getStravaCredentials();
      const { data: connection, error } = await admin.from("strava_connections")
        .select("refresh_token_ciphertext, refresh_token_iv")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return json({ error: "connection_lookup_failed" }, 500);
      if (!connection) return json({ disconnected: true, activities_retained: true });

      const refreshToken = await decryptToken(
        connection.refresh_token_ciphertext,
        connection.refresh_token_iv,
      );
      const basic = btoa(clientId + ":" + clientSecret);
      const revokeBody = new URLSearchParams({
        token: refreshToken,
        token_type_hint: "refresh_token",
      });
      const revoke = await fetch("https://www.strava.com/oauth/revoke", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + basic,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: revokeBody,
      });
      if (!revoke.ok) {
        console.error("Strava revoke failed", revoke.status);
        return json({ error: "provider_revocation_failed" }, 502);
      }

      const { error: deleteError } = await admin.from("strava_connections")
        .delete().eq("user_id", user.id);
      if (deleteError) return json({ error: "connection_delete_failed" }, 500);
      return json({ disconnected: true, activities_retained: true });
    }

    return json({ error: "unsupported_action" }, 400);
  } catch (error) {
    console.error("Strava connection handler failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "server_configuration_or_processing_error" }, 500);
  }
});
