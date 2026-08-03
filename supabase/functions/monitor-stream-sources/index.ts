import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SOURCES = [
  {
    key: "primary",
    label: "Primary Feed (GetStreamHosting)",
    url: "https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8",
  },
  {
    key: "backup",
    label: "Backup Feed (MetsXM HLS)",
    url: `${SUPABASE_URL}/functions/v1/hls-proxy/hls/metsxmfanzone.m3u8`,
  },
];

async function probe(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MetsXMFanZone-StreamMonitor" },
      cache: "no-store",
    } as RequestInit);
    const body = res.ok ? await res.text() : "";
    const isPlaylist = body.includes("#EXTM3U");
    const hasSegments = /#EXTINF/.test(body);
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    if (!isPlaylist) {
      return { ok: false, status: res.status, error: "Response is not a valid HLS playlist" };
    }
    if (!hasSegments) {
      return { ok: false, status: res.status, error: "Playlist has no media segments (encoder offline?)" };
    }
    return { ok: true, status: res.status, error: null as string | null };
  } catch (e) {
    return { ok: false, status: null as number | null, error: (e as Error).message || "Request failed" };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const now = new Date().toISOString();
    const results: Record<string, unknown>[] = [];
    const newlyDown: string[] = [];

    for (const src of SOURCES) {
      const result = await probe(src.url);

      const { data: existing } = await supabase
        .from("stream_source_status")
        .select("id, is_up, consecutive_failures")
        .eq("source_key", src.key)
        .maybeSingle();

      const consecutive = result.ok ? 0 : (existing?.consecutive_failures ?? 0) + 1;
      const wasUp = existing?.is_up ?? true;

      const row = {
        source_key: src.key,
        label: src.label,
        url: src.url,
        is_up: result.ok,
        status_code: result.status,
        last_error: result.error,
        consecutive_failures: consecutive,
        checked_at: now,
        ...(result.ok ? { last_ok_at: now } : { last_down_at: now }),
      };

      await supabase.from("stream_source_status").upsert(row, { onConflict: "source_key" });

      if (!result.ok && wasUp) newlyDown.push(src.label);
      results.push({ source: src.key, ...result });
    }

    // Notify admins (push) only on a fresh outage transition
    if (newlyDown.length > 0) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
            "X-System-Call": "true",
          },
          body: JSON.stringify({
            title: "🔴 Stream feed down",
            body: `${newlyDown.join(" & ")} stopped responding.`,
            url: "/admin/stream-health",
            icon: "/logo-192.png",
            tag: "stream-source-down",
            admin_only: true,
          }),
        });
      } catch (pushErr) {
        console.error("Push notify failed:", pushErr);
      }
    }

    return new Response(JSON.stringify({ checked_at: now, results, newly_down: newlyDown }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("monitor-stream-sources error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
