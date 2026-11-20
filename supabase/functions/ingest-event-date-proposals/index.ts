import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OWNER_ID = "a5d10e85-e559-4d44-9ee0-d8b8de08262f";
const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "trail-event-proposals";
const ALLOWED_WORKFLOWS = new Set([
  "Mitschi77/Trail-Event-app/.github/workflows/update-event-dates.yml@refs/heads/main",
  "Mitschi77/Trail-Event-app/.github/workflows/find-missing-event-data.yml@refs/heads/main",
]);
const JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let claims;
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token || token === auth) return new Response("Unauthorized", { status: 401 });
    ({ payload: claims } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE }));
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  if (claims.repository !== "Mitschi77/Trail-Event-app" ||
      claims.ref !== "refs/heads/main" ||
      !ALLOWED_WORKFLOWS.has(String(claims.workflow_ref || ""))) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    if (!Array.isArray(body.proposals) || body.proposals.length > 300) {
      return new Response("Invalid proposals", { status: 400 });
    }
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Supabase server configuration missing");
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const valid = [];
    for (const p of body.proposals) {
      const payload = p?.payload;
      const validDate = ["event_change", "route_change"].includes(p?.proposal_type) &&
        payload?.source === "official_event_date_feed" &&
        typeof payload.eventId === "string" && typeof payload.field === "string";
      const validData = p?.proposal_type === "data_correction" &&
        payload?.source === "automated_event_data_finder" &&
        typeof payload.eventId === "string" &&
        typeof payload.routeId === "string" &&
        ["gpxMetrics", "cutoffCandidate", "maxh", "dateCandidate", "starttimeCandidate", "raceCostCandidate"].includes(payload.field) &&
        typeof payload.sourceUrl === "string" &&
        (payload.field.endsWith("Candidate") ? Array.isArray(payload.newValue) && payload.newValue.length > 0 && payload.newValue.length <= 4 && payload.newValue.every((item: unknown) => typeof item === "string" && item.length <= 500) : true) &&
        payload.requiresOwnerApproval === true;
      if (!p || !["event_change", "route_change", "data_correction"].includes(p.proposal_type) ||
          typeof p.title !== "string" || !p.title.trim() || p.title.length > 240 ||
          !payload || typeof payload !== "object" || Array.isArray(payload) ||
          !(validDate || validData)) {
        return new Response("Invalid proposal item", { status: 400 });
      }
      valid.push(p);
    }

    const types = [...new Set(valid.map((p) => p.proposal_type))];
    const { data: pending, error: pendingError } = await supabase
      .from("event_change_proposals").select("proposal_type,payload")
      .eq("submitted_by", OWNER_ID).eq("status", "pending")
      .in("proposal_type", types).limit(5000);
    if (pendingError) throw pendingError;

    const keyOf = (type, x) => [type || "", x?.eventId || "", x?.routeId || "", x?.field || ""].join("|");
    const existing = new Set((pending || []).map((row) => keyOf(row.proposal_type, row.payload)));
    const unique = new Map();
    for (const p of valid) {
      const k = keyOf(p.proposal_type, p.payload);
      if (!existing.has(k) && !unique.has(k)) unique.set(k, p);
    }
    const rows = [...unique.values()].map((p) => ({
      submitted_by: OWNER_ID,
      proposal_type: p.proposal_type,
      title: p.title,
      payload: p.payload,
      status: "pending",
    }));

    if (!rows.length) {
      return Response.json({ success: true, inserted: 0, duplicates: valid.length });
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from("event_change_proposals").insert(rows).select("id");
    if (insertError) throw insertError;

    // Avoid one push invocation per proposal. A single batch notification is enough,
    // and no invocation is made when the owner has not registered a push subscription.
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("event_push_subscriptions").select("id").eq("user_id", OWNER_ID).limit(1);
    let push = "not-configured";
    if (subscriptionError) {
      console.warn("Could not check owner push subscriptions", subscriptionError);
      push = "check-failed";
    } else if (subscriptions?.length && insertedRows?.length) {
      try {
        const response = await fetch(`${url}/functions/v1/send-event-review-push`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ proposal_id: insertedRows[0].id }),
        });
        push = response.ok ? "sent" : `failed-${response.status}`;
      } catch (error) {
        console.warn("Batch push notification dispatch failed", error);
        push = "failed";
      }
    }
    return Response.json({
      success: true,
      inserted: insertedRows?.length || 0,
      duplicates: valid.length - (insertedRows?.length || 0),
      push,
    });
  } catch (error) {
    console.error("Proposal ingestion failed", error);
    return new Response("Proposal ingestion failed", { status: 500 });
  }
});
