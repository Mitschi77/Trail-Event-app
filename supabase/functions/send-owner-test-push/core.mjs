export function createOwnerTestPushHandler({ env, createClient, webpush, ownerId, logger = console, now = () => Date.now() }) {
  const cors = {
    "Access-Control-Allow-Origin": "https://mitschi77.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

  return async function handleOwnerTestPush(req) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

    try {
      const url = env.get("SUPABASE_URL");
      const anonKey = env.get("SUPABASE_ANON_KEY");
      const serviceKey = env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !anonKey || !serviceKey) return json({ error: "Serverkonfiguration unvollständig." }, 503);

      const authHeader = req.headers.get("Authorization") || "";
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) return json({ error: "Anmeldung erforderlich." }, 401);
      if (userData.user.id !== ownerId) return json({ error: "Nur der Inhaber darf den Push-Test starten." }, 403);

      const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { data: allowed, error: rateLimitError } = await admin.rpc("claim_event_push_rate_limit", {
        p_caller_id: ownerId,
      });
      if (rateLimitError) {
        logger.error("Push test rate limit failed", rateLimitError);
        return json({ error: "Benachrichtigungsschutz ist vorübergehend nicht verfügbar." }, 503);
      }
      if (!allowed) return json({ error: "Zu viele Push-Tests. Bitte in zehn Minuten erneut versuchen." }, 429);

      const { data: config, error: configError } = await admin.rpc("get_trail_push_vapid_config");
      if (configError || !config?.private_key || !config?.public_key || !config?.subject) {
        logger.error("Push test VAPID config unavailable", configError);
        return json({ error: "VAPID-Konfiguration im sicheren Speicher nicht verfügbar." }, 503);
      }
      webpush.setVapidDetails(config.subject, config.public_key, config.private_key);

      const { data: subscriptions, error: subscriptionError } = await admin
        .from("event_push_subscriptions")
        .select("id, endpoint, p256dh, auth_secret")
        .eq("user_id", ownerId);
      if (subscriptionError) return json({ error: "Registrierte Geräte konnten nicht geladen werden." }, 500);
      if (!subscriptions?.length) return json({ sent: 0, removed: 0, failed: 0, noSubscriptions: true }, 200);

      const payload = JSON.stringify({
        title: "Trailrunning-Manager · Push-Test",
        body: "Push-Mitteilungen funktionieren auf diesem Gerät.",
        url: "/Trail-Event-app/",
        tag: "trail-event-push-test-" + now(),
      });
      let sent = 0, removed = 0, failed = 0;
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } },
            payload,
          );
          sent++;
        } catch (err) {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            const { error: deleteError } = await admin.from("event_push_subscriptions")
              .delete().eq("id", sub.id).eq("user_id", ownerId);
            if (deleteError) {
              failed++;
              logger.error("Could not remove expired push subscription", deleteError);
            } else {
              removed++;
            }
          } else {
            failed++;
            logger.error("Push test delivery failed", statusCode, err);
          }
        }
      }
      return json(
        { sent, removed, failed, noSubscriptions: false },
        sent > 0 || (removed > 0 && failed === 0) ? 200 : 502,
      );
    } catch (error) {
      logger.error("Owner push test failed unexpectedly", error);
      return json({ error: "Push-Test konnte nicht verarbeitet werden." }, 500);
    }
  };
}
