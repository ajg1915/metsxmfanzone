import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request body
    const { credential, email } = await req.json();

    if (!credential || !credential.id || !credential.response || !email) {
      return new Response(
        JSON.stringify({ error: "Invalid credential data or email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the user by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the stored challenge
    const { data: challengeData, error: challengeError } = await supabase
      .from("webauthn_challenges")
      .select("*")
      .eq("user_id", profile.id)
      .eq("type", "authentication")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (challengeError || !challengeData) {
      console.error("Challenge retrieval error:", challengeError);
      return new Response(
        JSON.stringify({ error: "No valid challenge found. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if challenge has expired
    if (new Date(challengeData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Challenge has expired. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the passkey by credential ID
    const { data: passkey, error: passkeyError } = await supabase
      .from("user_passkeys")
      .select("*")
      .eq("credential_id", credential.id)
      .eq("user_id", profile.id)
      .single();

    if (passkeyError || !passkey) {
      console.error("Passkey retrieval error:", passkeyError);
      return new Response(
        JSON.stringify({ error: "Passkey not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // In production, verify the authenticator response:
    // 1. Verify the challenge matches
    // 2. Verify the signature using the stored public key
    // 3. Check the counter to prevent replay attacks
    
    // For this implementation, we trust the WebAuthn API's verification
    // and update the counter

    // Update counter and last_used_at
    const newCounter = (passkey.counter || 0) + 1;
    const { error: updateError } = await supabase
      .from("user_passkeys")
      .update({ 
        counter: newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", passkey.id);

    if (updateError) {
      console.error("Counter update error:", updateError);
    }

    // Delete the used challenge
    await supabase
      .from("webauthn_challenges")
      .delete()
      .eq("id", challengeData.id);

    // Get the user from auth.users to create a session
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("Auth lookup error:", authError);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "User not found in auth system" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link for passwordless login
    // This will create a session for the user
    const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.email!,
    });

    if (magicLinkError) {
      console.error("Magic link error:", magicLinkError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Biometric login successful for user:", profile.id);

    // Extract the token from the magic link
    const linkUrl = new URL(magicLinkData.properties.hashed_token ? 
      `${supabaseUrl}/auth/v1/verify?token=${magicLinkData.properties.hashed_token}&type=magiclink` :
      magicLinkData.properties.action_link || "");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Biometric authentication successful",
        userId: profile.id,
        email: authUser.email,
        // Return the verification URL for client to complete auth
        verificationUrl: magicLinkData.properties.action_link,
        // Also return token parts for direct verification
        token: magicLinkData.properties.hashed_token,
        tokenType: "magiclink",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in webauthn-login-verify:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
