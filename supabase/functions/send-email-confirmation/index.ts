import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

interface EmailConfirmationRequest {
  email: string;
  name?: string;
  userId: string;
  token?: string; // Optional - if not provided, we'll create one
}

Deno.serve(async (req) => {
  console.log("send-email-confirmation: request received", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    let { email, name, userId, token }: EmailConfirmationRequest = body;

    console.log("send-email-confirmation: processing for", email);

    if (!email || !userId) {
      console.error("send-email-confirmation: Missing required fields", { email: !!email, userId: !!userId });
      return new Response(
        JSON.stringify({ error: "Email and userId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role for token management
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If no token provided, generate one and store it
    if (!token) {
      token = crypto.randomUUID() + "-" + Date.now().toString(36);
      console.log("send-email-confirmation: generated new token for", email);
    }

    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const normalizedEmail = email.toLowerCase().trim();

    // Delete any existing unconfirmed tokens for this user before inserting new one
    const { error: deleteError } = await supabase
      .from("email_confirmation_tokens")
      .delete()
      .eq("user_id", userId)
      .is("confirmed_at", null);

    if (deleteError) {
      console.log("send-email-confirmation: could not clean old tokens", deleteError);
      // Continue anyway
    }

    // Insert the new token
    const { error: tokenError } = await supabase
      .from("email_confirmation_tokens")
      .insert({
        user_id: userId,
        token: token,
        email: normalizedEmail,
        expires_at: tokenExpiry.toISOString(),
      });

    if (tokenError) {
      console.error("send-email-confirmation: failed to store token", tokenError);
      // Don't fail - the email is still useful for support purposes
    } else {
      console.log("send-email-confirmation: token stored successfully");
    }

    // Create confirmation link using custom domain
    const baseUrl = "https://metsxmfanzone.com";
    const confirmationLink = `${baseUrl}/confirm-account?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email.toLowerCase().trim())}`;

    const subject = "Confirm Your MetsXMFanZone Account";
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: #0a0a0a;">
        <div style="max-width: 320px; margin: 0 auto; background-color: #1a1a2e; border-radius: 8px; padding: 20px; border: 1px solid #2a2a3e;">
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
            <div>
              <span style="color: #002D72; font-size: 18px; font-weight: bold;">Mets</span><span style="color: #FF5910; font-size: 18px; font-weight: bold;">XM</span><span style="color: #ffffff; font-size: 18px; font-weight: bold;">FanZone</span>
            </div>
          </div>
          
          <p style="color: #ffffff; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">
            Welcome, ${name || "Mets Fan"}!
          </p>
          
          <p style="color: #a0a0a0; text-align: center; font-size: 12px; margin: 0 0 16px;">
            Please confirm your email address to activate your account.
          </p>
          
          <div style="text-align: center; margin-bottom: 16px;">
            <a href="${confirmationLink}" style="display: inline-block; background: linear-gradient(135deg, #FF5910, #FF7A3D); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">
              Confirm Email
            </a>
          </div>
          
          <p style="color: #666; text-align: center; font-size: 10px; margin: 0 0 16px;">
            Or copy and paste this link:<br/>
            <a href="${confirmationLink}" style="color: #FF5910; word-break: break-all; font-size: 9px;">${confirmationLink}</a>
          </p>
          
          <div style="background: #002D72; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
            <p style="color: #ffffff; font-size: 11px; margin: 0 0 8px; font-weight: bold;">After confirming:</p>
            <ul style="color: #d0d0d0; font-size: 10px; margin: 0; padding-left: 16px;">
              <li style="margin-bottom: 4px;">Choose a subscription plan</li>
              <li style="margin-bottom: 4px;">Watch live streams</li>
              <li style="margin-bottom: 4px;">Connect with fans</li>
            </ul>
          </div>
          
          <p style="color: #888; text-align: center; font-size: 10px; margin: 0 0 12px;">
            This link expires in 24 hours.
          </p>
          
          <p style="color: #FF5910; text-align: center; font-size: 12px; font-weight: bold; margin: 0 0 12px;">
            Let's Go Mets!
          </p>
          
          <div style="border-top: 1px solid #2a2a3e; padding-top: 12px;">
            <p style="color: #555; font-size: 10px; text-align: center; margin: 0 0 10px;">
              The MetsXMFanZone Team
            </p>
            <div style="text-align: center; margin-bottom: 8px;">
              <a href="https://www.facebook.com/MetsXMFanZone" style="display: inline-block; margin: 0 6px; text-decoration: none;">
                <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" alt="Facebook" style="width: 20px; height: 20px; opacity: 0.7;" />
              </a>
              <a href="https://twitter.com/MetsXMFanZone" style="display: inline-block; margin: 0 6px; text-decoration: none;">
                <img src="https://cdn-icons-png.flaticon.com/24/733/733579.png" alt="Twitter" style="width: 20px; height: 20px; opacity: 0.7;" />
              </a>
              <a href="https://www.instagram.com/MetsXMFanZone" style="display: inline-block; margin: 0 6px; text-decoration: none;">
                <img src="https://cdn-icons-png.flaticon.com/24/733/733558.png" alt="Instagram" style="width: 20px; height: 20px; opacity: 0.7;" />
              </a>
              <a href="https://www.youtube.com/@MetsXMFanZone" style="display: inline-block; margin: 0 6px; text-decoration: none;">
                <img src="https://cdn-icons-png.flaticon.com/24/733/733646.png" alt="YouTube" style="width: 20px; height: 20px; opacity: 0.7;" />
              </a>
            </div>
            <p style="color: #444; font-size: 9px; text-align: center; margin: 0;">
              <a href="https://metsxmfanzone.com" style="color: #FF5910; text-decoration: none;">metsxmfanzone.com</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version for better deliverability
    const plainText = `
Welcome to MetsXMFanZone, ${name || "Mets Fan"}!

Please confirm your email address to activate your account.

Click here to confirm: ${confirmationLink}

After confirming:
- Choose a subscription plan
- Watch live streams
- Connect with fans

This link expires in 24 hours.

Let's Go Mets!

The MetsXMFanZone Team
https://metsxmfanzone.com
    `.trim();

    const emailResponse = await resend.emails.send({
      from: "MetsXMFanZone <noreply@notify.www.metsxmfanzone.com>",
      to: [email],
      subject: subject,
      html: emailContent,
      text: plainText, // Add plain text for better deliverability
      headers: {
        "X-Entity-Ref-ID": userId,
        "List-Unsubscribe": "<mailto:unsubscribe@notify.www.metsxmfanzone.com>",
        "X-Priority": "1", // High priority
        "Importance": "high",
      },
    });

    console.log("send-email-confirmation: SUCCESS", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-email-confirmation: ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
