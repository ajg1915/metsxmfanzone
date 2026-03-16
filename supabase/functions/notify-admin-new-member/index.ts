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
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    const { userId, planType, amount, source } = await req.json();

    if (!userId || !planType) {
      return new Response(
        JSON.stringify({ error: "userId and planType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the new member's profile
    const { data: memberProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    const memberName = escapeHtml(memberProfile?.full_name || "Unknown");
    const memberEmail = escapeHtml(memberProfile?.email || "No email");
    const safePlanType = escapeHtml(planType);
    const safeAmount = escapeHtml(amount || (planType === "annual" ? "$99.99" : "$9.99"));
    const safeSource = escapeHtml(source || "Online Payment");

    // Get all admin users
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admin users found to notify");
      return new Response(
        JSON.stringify({ message: "No admins to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin emails
    const adminIds = adminRoles.map((r) => r.user_id);
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", adminIds);

    const adminEmails = (adminProfiles || [])
      .filter((p) => p.email)
      .map((p) => p.email!);

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ message: "No admin emails" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const logoUrl = "https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png";
    const dashboardUrl = "https://metsxmfanzone.com/admin/subscriptions";
    const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #002D72; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <div style="max-width: 400px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 15px 0;">
      <img src="${logoUrl}" alt="MetsXMFanZone" style="width: 85px; height: auto; border-radius: 12px;" />
      <h2 style="color: #FF4500; margin: 8px 0 0 0; font-size: 18px;">🎉 New Member Alert!</h2>
    </div>
    <div style="background: linear-gradient(180deg, #1a1f2e 0%, #0f1420 100%); border: 1px solid rgba(255, 69, 0, 0.3); border-radius: 12px; padding: 24px;">
      <div style="background: linear-gradient(135deg, #002D72, #FF4500); border-radius: 8px; padding: 16px; margin-bottom: 16px; text-align: center;">
        <p style="color: white; font-size: 24px; margin: 0;">🏟️</p>
        <p style="color: white; font-size: 16px; font-weight: bold; margin: 8px 0 0 0;">New Fan Joined!</p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Member</td>
          <td style="padding: 8px 0; color: #F9FAFB; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${memberName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Email</td>
          <td style="padding: 8px 0; color: #F9FAFB; font-size: 13px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${memberEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Plan</td>
          <td style="padding: 8px 0; color: #FF4500; font-size: 13px; font-weight: bold; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${safePlanType.toUpperCase()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Amount</td>
          <td style="padding: 8px 0; color: #10B981; font-size: 13px; font-weight: bold; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${safeAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Source</td>
          <td style="padding: 8px 0; color: #F9FAFB; font-size: 13px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${safeSource}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9CA3AF; font-size: 13px;">Date</td>
          <td style="padding: 8px 0; color: #F9FAFB; font-size: 13px; text-align: right;">${now} ET</td>
        </tr>
      </table>
      <div style="text-align: center; margin-top: 20px;">
        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF4500, #FF6A33); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 13px;">
          View in Admin Dashboard
        </a>
      </div>
    </div>
    <p style="color: #6B7280; font-size: 10px; text-align: center; margin-top: 15px;">
      © ${new Date().getFullYear()} <span style="color: #FF4500;">MetsXMFanZone</span> — Admin Notification
    </p>
  </div>
</body>
</html>`;

    // Send to all admins
    const results = await Promise.all(
      adminEmails.map(async (email) => {
        try {
          await resend.emails.send({
            from: "MetsXMFanZone <noreply@notify.www.metsxmfanzone.com>",
            to: [email],
            subject: `🎉 New ${safePlanType} Member: ${memberName} — MetsXMFanZone`,
            html: emailHtml,
          });
          return { success: true, email };
        } catch (err: any) {
          console.error(`Failed to notify admin ${email}:`, err.message);
          return { success: false, email, error: err.message };
        }
      })
    );

    const sent = results.filter((r) => r.success).length;
    console.log(`Admin notifications sent: ${sent}/${adminEmails.length}`);

    // Also send push notification to admins
    try {
      const { data: adminSubs } = await supabase
        .from("notification_subscriptions")
        .select("*")
        .in("user_id", adminIds);

      if (adminSubs && adminSubs.length > 0) {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            title: `🎉 New ${safePlanType} Member!`,
            body: `${memberName} just signed up for ${safePlanType}. ${safeAmount}`,
            url: "/admin/subscriptions",
            icon: "/logo-192.png",
            tag: "new-member-notification",
            targetUsers: adminIds,
          },
        });
      }
    } catch (pushErr) {
      console.error("Push notification to admins failed:", pushErr);
    }

    return new Response(
      JSON.stringify({ success: true, notified: sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-admin-new-member:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
