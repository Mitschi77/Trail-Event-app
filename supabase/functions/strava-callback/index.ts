import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  encryptToken,
  exchangeStravaToken,
  getAdminClient,
  getStravaCredentials,
  hasActivityReadScope,
  redirectToApp,
  sha256Hex,
} from "../_shared/strava.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "";
  if (!state) return redirectToApp("error", "missing_state");

  try {
    const admin = getAdminClient();
    const stateHash = await sha256Hex(state);
    const now = new Date().toISOString();
    const { data: stateRow, error: stateError } = await admin.from("strava_oauth_states")
      .update({ consumed_at: now })
      .eq("state_hash", stateHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("user_id")
      .maybeSingle();

    if (stateError || !stateRow?.user_id) return redirectToApp("error", "invalid_or_expired_state");

    const providerError = url.searchParams.get("error");
    if (providerError) return redirectToApp("error", "authorization_denied");

    const code = url.searchParams.get("code");
    if (!code) return redirectToApp("error", "missing_authorization_code");

    const { clientId, clientSecret } = getStravaCredentials();
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    });
    const token = await exchangeStravaToken(tokenBody);
    const scope = String(token.scope || url.searchParams.get("scope") || "");
    if (!hasActivityReadScope(scope)) return redirectToApp("error", "activity_read_scope_missing");
    if (!token.access_token || !token.refresh_token || !token.expires_at || !token.athlete?.id) {
      return redirectToApp("error", "incomplete_provider_response");
    }

    const access = await encryptToken(String(token.access_token));
    const refresh = await encryptToken(String(token.refresh_token));
    const { error: saveError } = await admin.from("strava_connections").upsert({
      user_id: stateRow.user_id,
      athlete_id: String(token.athlete.id),
      access_token_ciphertext: access.ciphertext,
      access_token_iv: access.iv,
      refresh_token_ciphertext: refresh.ciphertext,
      refresh_token_iv: refresh.iv,
      expires_at: Number(token.expires_at),
      scope,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_synced_at: null,
      history_before: null,
      history_complete: false,
    }, { onConflict: "user_id" });

    if (saveError) {
      console.error("Strava connection save failed", saveError.message);
      return redirectToApp("error", "connection_storage_failed");
    }

    return redirectToApp("connected");
  } catch (error) {
    console.error("Strava OAuth callback failed", error instanceof Error ? error.message : "unknown");
    return redirectToApp("error", "server_configuration_or_exchange_failed");
  }
});
