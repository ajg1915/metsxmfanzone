import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor, escapeHtml } from '../_shared/email-brand.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

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
      return new Response(
        JSON.stringify({ message: "No eligible subscribers", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subIds = eligibleSubs.map((s) => s.id);
    const { data: alreadySent } = await supabase
      .from("review_request_emails")
      .select("subscription_id")
      .in("subscription_id", subIds);

    const alreadySentIds = new Set((alreadySent || []).map((r) => r.subscription_id));
    const toSend = eligibleSubs.filter((s) => !alreadySentIds.has(s.id));

    if (toSend.length === 0) {
      return new Response(
        JSON.stringify({ message: "All already sent", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = toSend.map((s) => s.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const feedbackUrl = "https://metsxmfanzone.com/feedback";

    let sentCount = 0;

    for (const sub of toSend) {
      const profile = profileMap.get(sub.user_id);
      if (!profile?.email) continue;

      const safeName = escapeHtml(profile.full_name || "Fan");
      const safePlan = escapeHtml(sub.plan_type);

      const emailHtml = await renderBrandedEmailFor(supabase, {
        preheader: "48-Hour Check-In: how's your experience so far?",
        heading: "⭐ How's Your Experience?",
        content: `
          <p style="margin:0 0 16px;text-align:center;color:#9CA3AF;font-size:13px;">48-Hour Check-In</p>
          <p style="margin:0 0 16px;">Hey ${safeName}! 👋</p>
          <p style="margin:0 0 16px;">You've been a <strong style="color:#FF5910;">${safePlan.toUpperCase()}</strong> member for 48 hours now, and we'd love to hear how things are going!</p>
          <p style="margin:0;">Your feedback helps us make MetsXMFanZone the best fan community possible.</p>`,
        cta: { label: "⭐ Leave Your Review", url: feedbackUrl },
        note: "Your review means the world to us! 🏟️",
      });

      try {
        await queueTransactionalEmail(supabase, {
          to: profile.email,
          subject: "⭐ How's your first 48 hours? We'd love your feedback!",
          html: emailHtml,
          label: "review_request_48h",
          idempotencyKey: `review-48h:${sub.id}`,
        });

        await supabase.from("review_request_emails").insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
        });

        sentCount++;
      } catch (emailErr: any) {
        console.error("Failed to queue review email:", emailErr.message);
      }
    }

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
