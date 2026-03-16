import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeHtml = (str: string) => {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m] || m));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    // Find paid subscriptions created ~48 hours ago that haven't been sent a review email
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const fiftyHoursAgo = new Date(now.getTime() - 50 * 60 * 60 * 1000);

    const { data: eligibleSubs, error: subsError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_type, amount, created_at")
      .in("plan_type", ["premium", "annual"])
      .eq("status", "active")
      .gte("created_at", fiftyHoursAgo.toISOString())
      .lte("created_at", fortyEightHoursAgo.toISOString());

    if (subsError) throw subsError;

    if (!eligibleSubs || eligibleSubs.length === 0) {
      console.log("No eligible subscribers for 48h review email");
      return new Response(
        JSON.stringify({ message: "No eligible subscribers", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out already-sent emails
    const subIds = eligibleSubs.map((s) => s.id);
    const { data: alreadySent } = await supabase
      .from("review_request_emails")
      .select("subscription_id")
      .in("subscription_id", subIds);

    const alreadySentIds = new Set((alreadySent || []).map((r) => r.subscription_id));
    const toSend = eligibleSubs.filter((s) => !alreadySentIds.has(s.id));

    if (toSend.length === 0) {
      console.log("All eligible subscribers already emailed");
      return new Response(
        JSON.stringify({ message: "All already sent", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get profiles for these users
    const userIds = toSend.map((s) => s.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const logoUrl = "https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png";
    const feedbackUrl = "https://metsxmfanzone.com/feedback";

    let sentCount = 0;

    for (const sub of toSend) {
      const profile = profileMap.get(sub.user_id);
      if (!profile?.email) continue;

      const safeName = escapeHtml(profile.full_name || "Fan");
      const safePlan = escapeHtml(sub.plan_type);

      const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #002D72; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 20px 0;">
      <img src="${logoUrl}" alt="MetsXMFanZone" style="width: 85px; height: auto; border-radius: 12px;" />
    </div>
    <div style="background: linear-gradient(180deg, #1a1f2e 0%, #0f1420 100%); border: 1px solid rgba(255, 69, 0, 0.3); border-radius: 12px; padding: 28px;">
      <h1 style="color: #FF4500; font-size: 22px; margin: 0 0 8px 0; text-align: center;">⭐ How's Your Experience?</h1>
      <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin: 0 0 20px 0;">48-Hour Check-In</p>
      
      <p style="color: #F9FAFB; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
        Hey ${safeName}! 👋
      </p>
      <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
        You've been a <strong style="color: #FF4500;">${safePlan.toUpperCase()}</strong> member for 48 hours now, and we'd love to hear how things are going!
      </p>
      <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
        Your feedback helps us make MetsXMFanZone the best fan community possible. It only takes a minute — tell us what you love, what could be better, or just share your thoughts.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${feedbackUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF4500, #FF6A33); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px;">
          ⭐ Leave Your Review
        </a>
      </div>

      <p style="color: #6B7280; font-size: 12px; text-align: center; line-height: 1.5; margin: 20px 0 0 0;">
        Your review means the world to us and helps other Mets fans discover the community. Thank you for being part of the family! 🏟️
      </p>
    </div>
    <p style="color: #6B7280; font-size: 10px; text-align: center; margin-top: 15px;">
      © ${new Date().getFullYear()} <span style="color: #FF4500;">MetsXMFanZone</span> — You're receiving this because you're a valued member.
    </p>
  </div>
</body>
</html>`;

      try {
        await resend.emails.send({
          from: "MetsXMFanZone <noreply@notify.www.metsxmfanzone.com>",
          to: [profile.email],
          subject: "⭐ How's your first 48 hours? We'd love your feedback!",
          html: emailHtml,
        });

        // Record that we sent the email
        await supabase.from("review_request_emails").insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
        });

        sentCount++;
        console.log(`Review email sent to user: [REDACTED]`);
      } catch (emailErr: any) {
        console.error(`Failed to send review email:`, emailErr.message);
      }
    }

    console.log(`48h review emails sent: ${sentCount}/${toSend.length}`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: toSend.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-review-request-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
