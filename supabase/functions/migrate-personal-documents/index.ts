import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OWNER_USER_ID = "a5d10e85-e559-4d44-9ee0-d8b8de08262f";
const FILES = [
  "Buchungsbeleg_Istria_Umag.pdf",
  "Buchungsbeleg_Philippsreut.pdf",
  "Buchungsbeleg_Mozart_Ferienwohnung_Aubichl.pdf",
  "Buchungsbeleg_Kranjska_Gora.pdf",
  "Zahlungsbeleg_Istria_110K.pdf",
  "Zahlungsbeleg_Mozart_Ultra.pdf",
  "Rechnung_3Kings3Hills_2027.pdf",
  "Rechnung_MOUNTAINMAN_Winterloop_2027.pdf",
];

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return new Response("Server configuration incomplete", { status: 500 });

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
  const { data: activeSession, error: sessionError } = await userClient.rpc("is_current_auth_session_active");
  if (sessionError || activeSession !== true) {
    return new Response(JSON.stringify({ error: "Diese Sitzung wurde auf einem anderen Gerät beendet. Bitte erneut anmelden." }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  // These documents belong to the existing planner owner only. Never copy them
  // into another account merely because that account signs in on a shared device.
  if (userData.user.id !== OWNER_USER_ID) {
    return new Response(JSON.stringify({ error: "Dokumentmigration für dieses Konto nicht freigegeben." }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const results: { file: string; ok: boolean; error?: string }[] = [];
  for (const file of FILES) {
    try {
      const source = `https://raw.githubusercontent.com/Mitschi77/Trail-Event-app/main/docs/${encodeURIComponent(file)}`;
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const { error } = await admin.storage.from("trail-private-documents").upload(
        `${userData.user.id}/${file}`, bytes,
        { contentType: "application/pdf", upsert: true, cacheControl: "private, max-age=0" }
      );
      if (error) throw error;
      results.push({ file, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const failed = results.filter(x => !x.ok);
  return new Response(JSON.stringify({ migrated: results.filter(x => x.ok).length, failed, results }), {
    status: failed.length ? 207 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
