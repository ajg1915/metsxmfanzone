import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

type WelcomeRequest = {
  email?: string;
  name?: string;
  record?: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
  };
};

async function resolveRecipient(
  supabase: ReturnType<typeof createClient>,
  body: WelcomeRequest,
) {
  const directEmail = body.email?.trim().toLowerCase();
  if (directEmail) {
    return {
      email: directEmail,
      name: body.name?.trim() || "Mets Fan",
    };
  }

  const recordId = body.record?.id;
  if (!recordId) {
    return { email: null, name: null };
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(recordId);
  const email = authUser?.user?.email?.trim().toLowerCase() || body.record?.email?.trim().toLowerCase() || null;
  const name =
    body.name?.trim() ||
    body.record?.full_name?.trim() ||
    authUser?.user?.user_metadata?.full_name ||
    "Mets Fan";

  return { email, name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: WelcomeRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const recipient = await resolveRecipient(supabase, body);

    if (!recipient.email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error } = await supabase.functions.invoke("send-confirmation-email", {
      body: {
        type: "welcome",
        email: recipient.email,
        name: recipient.name,
      },
    });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in send-welcome-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});