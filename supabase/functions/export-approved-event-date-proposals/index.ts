import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OWNER_ID = "a5d10e85-e559-4d44-9ee0-d8b8de08262f";
const REPOSITORY = "Mitschi77/Trail-Event-app";
const WORKFLOW = "Mitschi77/Trail-Event-app/.github/workflows/export-approved-event-dates.yml@refs/heads/main";
const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "trail-event-date-export";
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
  if (claims.repository !== REPOSITORY || claims.ref !== "refs/heads/main" ||
      String(claims.actor_id || "") !== "162504698" || claims.workflow_ref !== WORKFLOW) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Supabase server configuration missing");
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("event_change_proposals")
      .select("id,status,proposal_type,title,payload,created_at")
      .eq("submitted_by", OWNER_ID)
      .eq("status", "approved")
      .is("published_at", null)
      .in("proposal_type", ["event_change", "route_change"])
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;

    const proposals = (data || []).filter((row) =>
      row.payload?.source === "official_event_date_feed" &&
      typeof row.payload?.eventId === "string" &&
      (row.proposal_type === "event_change"
        ? ["startDate", "endDate"].includes(row.payload?.field)
        : row.payload?.field === "date" && typeof row.payload?.routeId === "string")
    );
    return Response.json({
      success: true,
      totalApprovedDateProposals: proposals.length,
      proposals,
      truncated: (data || []).length === 100
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Approved date proposal export failed", error);
    return new Response("Proposal export failed", { status: 500 });
  }
});
