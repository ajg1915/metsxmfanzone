import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { queueTransactionalEmail } from "../_shared/queue-email.ts";
import { renderNyLiveEmail } from "../_shared/ny-live-email.ts";
import { NY_TEAM_BY_PAGE } from "../_shared/team-logos.ts";

const NY_PAGES = Object.keys(NY_TEAM_BY_PAGE);
const NY_EMAIL_WINDOW_MS = 6 * 60 * 60 * 1000; // only email events that went live in the last 6h
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "LIVE NOW" email + push for NY Sports events (Giants, Jets, Knicks, Nets,
// Rangers, Islanders). Runs every minute; each event is emailed once, whether
// it went live on its own schedule or was set live by hand in admin.
// deno-lint-ignore no-explicit-any
async function sendNyLiveEmails(supabase: any, supabaseUrl: string, serviceKey: string) {
  const { data: setting } = await supabase
    .from("gameday_email_settings")
    .select("enabled")
    .eq("trigger_type", "ny_sports_live")
    .maybeSingle();
  if (setting && setting.enabled === false) return { skipped: "ny_sports_live toggle is OFF" };

  const { data: live, error } = await supabase
    .from("live_streams")
    .select("id, title, assigned_pages, actual_start, scheduled_start, created_at")
    .eq("status", "live")
    .eq("published", true)
    .is("live_email_sent_at", null)
    .overlaps("assigned_pages", NY_PAGES);
  if (error) throw error;

  const sent: { id: string; title: string; emails: number }[] = [];
  for (const ev of live || []) {
    const startedAt = ev.actual_start || ev.scheduled_start || ev.created_at;
    if (!startedAt || Date.now() - new Date(startedAt).getTime() > NY_EMAIL_WINDOW_MS) continue;
    const nyPage = (ev.assigned_pages || []).find((p: string) => NY_PAGES.includes(p));
    if (!nyPage) continue;

    // Claim the event first so two overlapping runs can never email it twice.
    const { data: claimed } = await supabase
      .from("live_streams")
      .update({ live_email_sent_at: new Date().toISOString() })
      .eq("id", ev.id)
      .is("live_email_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const email = await renderNyLiveEmail(supabase, { id: ev.id, title: ev.title || "NY Sports", nyPage, startedAt });

    const { data: profiles } = await supabase.from("profiles").select("email").not("email", "is", null);
    const recipients = [...new Set((profiles || []).map((p: { email: string }) => (p.email || "").trim().toLowerCase()).filter(Boolean))] as string[];

    let count = 0;
    for (const to of recipients) {
      const payload = {
        to, subject: email.subject, html: email.html, text: email.text,
        label: "ny_sports_live",
        idempotencyKey: `ny-live-${ev.id}-${to}`,
        metadata: { live_stream_id: ev.id },
      };
      try {
        await queueTransactionalEmail(supabase, payload);
        count++;
      } catch (e) {
        // Resend allows ~2 sends/second; back off once and retry on a rate limit.
        if (String(e).includes("429")) {
          await sleep(1500);
          try { await queueTransactionalEmail(supabase, payload); count++; } catch (e2) { console.error(`NY live email failed for ${to}:`, e2); }
        } else {
          console.error(`NY live email failed for ${to}:`, e);
        }
      }
      await sleep(550);
    }

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, "X-System-Call": "true" },
        body: JSON.stringify({
          title: email.subject,
          body: `The ${email.teamName} are live now. Tap to watch.`,
          url: `/live/${ev.id}`,
          icon: "/logo-192.png",
          tag: `ny-live-${ev.id}`,
        }),
      });
    } catch (pushErr) {
      console.error(`NY live push failed for ${ev.id}:`, pushErr);
    }

    console.log(`NY live email sent for "${ev.title}" to ${count}/${recipients.length} members`);
    sent.push({ id: ev.id, title: ev.title, emails: count });
  }
  return { sent };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Test mode: { testTo, testStreamId } sends that event's NY live email to ONE
    // address, and only if that address belongs to an admin. Nothing else runs.
    const body = await req.json().catch(() => ({}));
    if (body?.testTo && body?.testStreamId) {
      const to = String(body.testTo).trim().toLowerCase();
      const { data: prof } = await supabase.from("profiles").select("id").eq("email", to).maybeSingle();
      const { data: role } = prof
        ? await supabase.from("user_roles").select("role").eq("user_id", prof.id).eq("role", "admin").maybeSingle()
        : { data: null };
      if (!role) {
        return new Response(JSON.stringify({ error: "Test emails can only go to an admin account" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ev } = await supabase.from("live_streams")
        .select("id, title, assigned_pages, actual_start, scheduled_start").eq("id", body.testStreamId).maybeSingle();
      const nyPage = (ev?.assigned_pages || []).find((p: string) => NY_PAGES.includes(p));
      if (!ev || !nyPage) {
        return new Response(JSON.stringify({ error: "Not a NY Sports event" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const email = await renderNyLiveEmail(supabase, {
        id: ev.id, title: ev.title, nyPage, startedAt: ev.actual_start || ev.scheduled_start,
      });
      const result = await queueTransactionalEmail(supabase, {
        to, subject: `[TEST] ${email.subject}`, html: email.html, text: email.text,
        label: "ny_sports_live_test", metadata: { live_stream_id: ev.id, test: true },
      });
      return new Response(JSON.stringify({ test: true, to, subject: email.subject, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // Find scheduled streams whose start time has passed
    const { data: allDue, error: fetchError } = await supabase
      .from("live_streams")
      .select("id, title, scheduled_start, assigned_pages")
      .eq("status", "scheduled")
      .eq("published", true)
      .lte("scheduled_start", now)
      .not("scheduled_start", "is", null);

    if (fetchError) throw fetchError;

    // Every published scheduled stream (Mets, Game Events, NY teams) flips to live at its start time.
    // The video feed is always running; only the page status flips.
    // Skip stale rows (started >12h ago) so old schedules never flip live by accident.
    const NON_METS = ["pix11-network","ny-jets","ny-giants","ny-knicks","ny-rangers","ny-islanders","brooklyn-nets"];
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    const streamsToGoLive = (allDue || []).filter((s: any) =>
      new Date(s.scheduled_start).getTime() >= cutoff
    );
    const isMetsStream = (s: any) =>
      !(s.assigned_pages || []).some((p: string) => NON_METS.includes(p)) && /\bmets\b/i.test(s.title || "");

    const results = [];

    for (const stream of streamsToGoLive) {
      // Update status to live
      const { error: updateError } = await supabase
        .from("live_streams")
        .update({ status: "live", actual_start: now })
        .eq("id", stream.id);

      if (updateError) {
        console.error(`Failed to update stream ${stream.id}:`, updateError);
        results.push({ id: stream.id, success: false });
        continue;
      }

      // Push notification only for real Mets games
      if (isMetsStream(stream)) try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'X-System-Call': 'true',
          },
          body: JSON.stringify({
            title: "🔴 LIVE NOW on MetsXMFanZone!",
            body: stream.title,
            url: "/metsxmfanzone",
            icon: "/logo-192.png",
            tag: `live-stream-${stream.id}`,
          }),
        });
      } catch (pushErr) {
        console.error(`Push notification failed for stream ${stream.id}:`, pushErr);
      }

      results.push({ id: stream.id, title: stream.title, success: true });
    }

    // Also end streams whose scheduled_end has passed
    const { data: streamsToEnd, error: endFetchError } = await supabase
      .from("live_streams")
      .select("id")
      .eq("status", "live")
      .lte("scheduled_end", now)
      .not("scheduled_end", "is", null);

    if (!endFetchError && streamsToEnd && streamsToEnd.length > 0) {
      for (const stream of streamsToEnd) {
        await supabase
          .from("live_streams")
          .update({ status: "ended", actual_end: now })
          .eq("id", stream.id);
      }
    }

    // NY Sports "LIVE NOW" emails. Never let a failure here stop the status flips above.
    let nyLive: unknown = null;
    try {
      nyLive = await sendNyLiveEmails(supabase, supabaseUrl, serviceKey);
    } catch (nyErr) {
      console.error("NY live email error:", nyErr);
      nyLive = { error: String((nyErr as Error)?.message ?? nyErr) };
    }

    return new Response(
      JSON.stringify({
        message: `Started ${results.filter(r => r.success).length} streams, ended ${streamsToEnd?.length || 0} streams`,
        started: results,
        ended: streamsToEnd?.length || 0,
        nyLive,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto stream status error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
