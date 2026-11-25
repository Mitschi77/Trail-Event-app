import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const APP_ORIGIN = "https://mitschi77.github.io";
export const APP_URL = "https://mitschi77.github.io/Trail-Event-app/";

export const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function redirectToApp(status: string, reason?: string): Response {
  const target = new URL(Deno.env.get("NORTHBOUND_APP_URL") || APP_URL);
  target.searchParams.set("integration", "strava");
  target.searchParams.set("status", status);
  if (reason) target.searchParams.set("reason", reason);
  return Response.redirect(target.toString(), 303);
}

function getNamedKey(envName: string, legacyName: string): string | null {
  const raw = Deno.env.get(envName);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.default === "string" && parsed.default) return parsed.default;
    } catch {
      // Older projects may not expose the new key map.
    }
  }
  return Deno.env.get(legacyName) || null;
}

export function getSupabaseUrl(): string {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) throw new Error("missing_supabase_url");
  return value.replace(/\/+$/, "");
}

export function getAdminClient() {
  const secret = getNamedKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("missing_supabase_server_key");
  return createClient(getSupabaseUrl(), secret, {
    // New sb_secret keys must be sent via apikey only, not Authorization: Bearer.
    // supabase-js adds Authorization by default, so strip it for server-key requests.
    global: {
      headers: { apikey: secret },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const publishable = getNamedKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  if (!publishable) throw new Error("missing_supabase_publishable_key");
  const client = createClient(getSupabaseUrl(), publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export function getStravaCredentials() {
  const clientId = Deno.env.get("STRAVA_CLIENT_ID");
  const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("missing_strava_credentials");
  return { clientId, clientSecret };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeEncryptionKey(value: string): Uint8Array {
  const normalized = value.trim();
  // A 64-character hexadecimal key is convenient to generate locally on iOS.
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  return decodeBase64(normalized);
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function encodeBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptionKey(): Promise<CryptoKey> {
  const encoded = Deno.env.get("STRAVA_TOKEN_ENCRYPTION_KEY");
  if (!encoded) throw new Error("missing_strava_token_encryption_key");
  const raw = decodeEncryptionKey(encoded);
  if (raw.length !== 32) throw new Error("invalid_strava_token_encryption_key");
  return await crypto.subtle.importKey("raw", asArrayBuffer(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(new TextEncoder().encode(token)),
  );
  return { ciphertext: encodeBase64(new Uint8Array(encrypted)), iv: encodeBase64(iv) };
}

export async function decryptToken(ciphertext: string, ivValue: string): Promise<string> {
  const key = await encryptionKey();
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(decodeBase64(ivValue)) },
    key,
    asArrayBuffer(decodeBase64(ciphertext)),
  );
  return new TextDecoder().decode(clear);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function exchangeStravaToken(
  body: URLSearchParams,
  endpoint = "https://www.strava.com/api/v3/oauth/token",
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("strava_token_exchange_failed_" + response.status);
  return payload;
}

export function hasActivityReadScope(scope: string): boolean {
  const scopes = new Set(scope.split(/[ ,]+/).filter(Boolean));
  return scopes.has("activity:read") || scopes.has("activity:read_all");
}
