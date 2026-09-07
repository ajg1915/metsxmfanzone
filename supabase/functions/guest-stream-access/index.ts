import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MetsXMFanZone Live always requires sign in — never served to guests
const BLOCKED_PAGES = ["metsxmfanzone", "metsxmfanzone-live"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pageKey = typeof body.pageKey === "string" ? body.pageKey.trim().slice(0, 120) : "";
    const streamId = typeof body.streamId === "string" ? body.streamId.trim().slice(0, 64) : "";

    if (!pageKey && !streamId) {
      return new Response(JSON.stringify({ error: "Missing stream reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (BLOCKED_PAGES.includes(pageKey.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Guest preview must be enabled by the admin
    const { data: settings } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "free_trial_config")
      .maybeSingle();

    const config = (settings?.setting_value ?? {}) as Record<string, unknown>;
    const enabled = config.guestPreviewEnabled !== false;
    const minutes = Math.max(1, Math.min(240, Number(config.guestPreviewMinutes) || 30));

    if (!enabled) {
      return new Response(JSON.stringify({ error: "Preview disabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("live_streams")
      .select("id, title, description, thumbnail_url, status, stream_url, assigned_pages")
      .eq("published", true)
      .eq("status", "live");

    const uuidMatch = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const idFromPage = pageKey.match(/^stream-(.+)$/)?.[1];
    const targetId = streamId || (idFromPage && uuidMatch.test(idFromPage) ? idFromPage : "");

    if (targetId) {
      if (!uuidMatch.test(targetId)) {
        return new Response(JSON.stringify({ error: "Invalid stream id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      query = query.eq("id", targetId);
    } else {
      query = query.contains("assigned_pages", [pageKey]);
    }

    const { data: stream, error } = await query
      .order("scheduled_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!stream) {
      return new Response(JSON.stringify({ stream: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pages: string[] = Array.isArray(stream.assigned_pages) ? stream.assigned_pages : [];
    if (pages.some((p) => BLOCKED_PAGES.includes(String(p).toLowerCase()))) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        previewMinutes: minutes,
        stream: {
          id: stream.id,
          title: stream.title,
          description: stream.description,
          thumbnail_url: stream.thumbnail_url,
          status: stream.status,
          stream_url: stream.stream_url,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("guest-stream-access error", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "Unable to load stream" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
