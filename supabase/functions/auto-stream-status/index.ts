import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Only real Mets games auto-start; Game Events / NY teams / other events stay scheduled
    const NON_METS = ["pix11-network","ny-jets","ny-giants","ny-knicks","ny-rangers","ny-islanders","brooklyn-nets"];
    const streamsToGoLive = (allDue || []).filter((s: any) =>
      !(s.assigned_pages || []).some((p: string) => NON_METS.includes(p)) && /\bmets\b/i.test(s.title || "")
    );

    if (!streamsToGoLive || streamsToGoLive.length === 0) {
      return new Response(JSON.stringify({ message: "No streams to start", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      // Send push notification
      try {
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

    return new Response(
      JSON.stringify({
        message: `Started ${results.filter(r => r.success).length} streams, ended ${streamsToEnd?.length || 0} streams`,
        started: results,
        ended: streamsToEnd?.length || 0,
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
