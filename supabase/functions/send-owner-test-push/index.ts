import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { createOwnerTestPushHandler } from "./core.mjs";

const OWNER_ID = "a5d10e85-e559-4d44-9ee0-d8b8de08262f";

const handler = createOwnerTestPushHandler({
  env: Deno.env,
  createClient,
  webpush,
  ownerId: OWNER_ID,
});

Deno.serve(handler);
