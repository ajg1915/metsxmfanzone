import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SECURITY: This endpoint previously accepted client-supplied WebAuthn assertions
// without verifying signatures, challenge binding, or counters — which would allow
// an attacker who knew a victim's email + credential_id to log in as them.
//
// The endpoint has been disabled until full server-side WebAuthn verification
// (e.g. via @simplewebauthn/server) is implemented. Clients should fall back to
// email/password login.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Best-effort: invalidate any pending challenge so we don't leave stale rows.
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      const body = await req.clone().json().catch(() => null);
      if (body?.email) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", String(body.email).toLowerCase())
          .maybeSingle();
        if (profile?.id) {
          await supabase
            .from("webauthn_challenges")
            .delete()
            .eq("user_id", profile.id)
            .eq("type", "authentication");
        }
      }
    }
  } catch (_) {
    // ignore — endpoint is disabled
  }

  return new Response(
    JSON.stringify({
      error: "Passkey login is temporarily disabled. Please sign in with your email and password.",
      code: "webauthn_disabled",
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
