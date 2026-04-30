// Auto-publishes blog posts whose scheduled_publish_at <= now().
// Designed to be called periodically (every few minutes) by a cron / scheduler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const nowIso = new Date().toISOString();

    // Find posts ready to publish
    const { data: due, error: fetchErr } = await supabase
      .from("blog_posts")
      .select("id, title, slug")
      .eq("published", false)
      .not("scheduled_publish_at", "is", null)
      .lte("scheduled_publish_at", nowIso);

    if (fetchErr) throw fetchErr;

    if (!due || due.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, published: 0, message: "Nothing due" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = due.map((p) => p.id);
    const { error: updateErr } = await supabase
      .from("blog_posts")
      .update({
        published: true,
        published_at: nowIso,
        is_draft: false,
        approval_status: "approved",
      })
      .in("id", ids);

    if (updateErr) throw updateErr;

    // Fire push notifications (best effort)
    for (const post of due) {
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            title: "📰 New Article on MetsXMFanZone!",
            body: post.title,
            url: `/blog/${post.slug}`,
            icon: "/logo-192.png",
            tag: `blog-${post.id}`,
          },
        });
      } catch (e) {
        console.error("Push failed for", post.id, e);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        published: due.length,
        ids,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("publish-scheduled-blogs error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
