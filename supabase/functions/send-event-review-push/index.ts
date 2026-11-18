import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const OWNER_ID = "a5d10e85-e559-4d44-9ee0-d8b8de08262f";
const VAPID_PUBLIC_KEY = "BAMKuxl4VO7kZvR2Mu2_J2nx4SdRvY_M-6lFmDHF6lnfRmmZAlCHHwzINyHfWIXEoFVlEWiF2Mff7QaadJFQ";
const cors = {
  "Access-Control-Allow-Origin": "https://mitschi77.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const internalCall = authHeader === `Bearer ${serviceKey}`;
  let callerId: string | null = null;
  if (!internalCall) {
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Anmeldung erforderlich." }, 401);
    callerId = userData.user.id;
  }

  let body: { proposal_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Ungültiger JSON-Inhalt." }, 400); }
  if (!body.proposal_id || !/^[0-9a-f-]{36}$/i.test(body.proposal_id)) return json({ error: "Vorschlags-ID fehlt." }, 400);

  const admin = createClient(url, serviceKey);
  const { data: proposal, error: proposalError } = await admin
    .from("event_change_proposals")
    .select("id, submitted_by, title, status, created_at, push_notified_at")
    .eq("id", body.proposal_id)
    .maybeSingle();
  if (proposalError || !proposal || proposal.submitted_by !== (internalCall ? OWNER_ID : callerId) || proposal.status !== "pending") {
    return json({ error: "Kein gültiger eigener offener Vorschlag." }, 403);
  }
  if (Date.now() - new Date(proposal.created_at).getTime() > 5 * 60 * 1000) return json({ error: "Der Vorschlag ist nicht mehr neu." }, 409);
  if (proposal.push_notified_at) return json({ sent: 0, duplicate: true });

  // Authenticated callers may trigger at most three owner push notifications per ten minutes.
  // Trusted server-to-server ingestion calls are separately authenticated with the service key.
  if (!internalCall) {
    const { data: allowed, error: rateLimitError } = await admin.rpc("claim_event_push_rate_limit", { p_caller_id: callerId });
    if (rateLimitError) {
      console.error("Push rate limit check failed", rateLimitError);
      return json({ error: "Benachrichtigungsschutz ist vorübergehend nicht verfügbar." }, 503);
    }
    if (!allowed) return json({ error: "Zu viele Benachrichtigungen. Bitte in zehn Minuten erneut versuchen." }, 429);
  }

  const { data: claimed, error: claimError } = await admin
    .from("event_change_proposals")
    .update({ push_notified_at: new Date().toISOString() })
    .eq("id", proposal.id)
    .is("push_notified_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) return json({ error: "Benachrichtigung konnte nicht reserviert werden." }, 500);
  if (!claimed) return json({ sent: 0, duplicate: true });

  const { data: config, error: configError } = await admin.rpc("get_trail_push_vapid_config");
  if (configError || !config?.private_key || !config?.subject) return json({ error: "VAPID-Konfiguration im Vault nicht verfügbar." }, 503);
  webpush.setVapidDetails(config.subject, VAPID_PUBLIC_KEY, config.private_key);

  const { data: subscriptions, error } = await admin
    .from("event_push_subscriptions")
    .select("id, endpoint, p256dh, auth_secret")
    .eq("user_id", OWNER_ID);
  if (error) return json({ error: "Abonnements konnten nicht geladen werden." }, 500);

  const payload = JSON.stringify({
    title: "Neuer Änderungsvorschlag",
    body: String(proposal.title || "Ein Vorschlag wartet auf deine Prüfung.").slice(0, 240),
    url: "/Trail-Event-app/",
    tag: "trail-event-review",
  });
  let sent = 0, removed = 0, failed = 0;
  for (const sub of subscriptions || []) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } }, payload);
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("event_push_subscriptions").delete().eq("id", sub.id).eq("user_id", OWNER_ID);
        removed++;
      } else failed++;
    }
  }
  return json({ sent, removed, failed });
});