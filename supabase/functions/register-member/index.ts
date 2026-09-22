import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const smsOptIn = body.smsOptIn === true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    if (fullName.length < 2) return json({ error: "Enter your full name" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Creating the user with the admin API never triggers a Supabase auth email.
    // Our own branded confirmation email is sent separately through Resend.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        phone_number: phoneNumber,
        sms_notifications_enabled: smsOptIn,
        preferred_payment_method: "paypal",
      },
    });

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
        return json({ error: "This email already has an account. Sign in instead." }, 409);
      }
      console.error("register-member: createUser failed", error.message);
      return json({ error: error.message || "Account could not be created" }, 400);
    }

    if (!data.user) return json({ error: "Account could not be created" }, 400);

    return json({ success: true, userId: data.user.id });
  } catch (error) {
    console.error("register-member: ERROR", error instanceof Error ? error.message : "unknown");
    return json({ error: "Account could not be created" }, 500);
  }
});
