import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callCloudflareAi, transformCloudflareStreamToOpenAi, cloudflareAiErrorResponse } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METS_TEAM_ID = 121;
const MLB_STATS_API = "https://statsapi.mlb.com/api/v1";

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function fetchMetsLiveGame(): Promise<string> {
  try {
    const today = getTodayET();
    const scheduleRes = await fetch(
      `${MLB_STATS_API}/schedule?sportId=1&teamId=${METS_TEAM_ID}&date=${today}`,
      { headers: { "Cache-Control": "no-cache, no-store" } }
    );
    if (!scheduleRes.ok) return "";
    const schedule = await scheduleRes.json();
    const game = schedule?.dates?.[0]?.games?.[0];
    if (!game) return "";

    const gamePk = game.gamePk;
    const status = game.status?.abstractGameState;
    const home = game.teams?.home?.team?.name ?? "Mets";
    const away = game.teams?.away?.team?.name ?? "Opponent";

    if (status === "Preview") {
      const gameTime = new Date(game.gameDate).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
        timeZoneName: "short",
      });
      return `Upcoming Mets game today: ${away} @ ${home} at ${gameTime} ET.`;
    }

    const liveRes = await fetch(`${MLB_STATS_API}/1.1/game/${gamePk}/feed/live`, {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
    if (!liveRes.ok) return "";
    const live = await liveRes.json();
    const linescore = live.liveData?.linescore;
    const homeScore = linescore?.teams?.home?.runs ?? 0;
    const awayScore = linescore?.teams?.away?.runs ?? 0;
    const inning = linescore?.currentInning ?? "";
    const inningState = linescore?.inningState ?? "";
    const outs = linescore?.outs ?? 0;

    if (status === "Final") {
      return `Mets final score: ${away} ${awayScore}, ${home} ${homeScore}.`;
    }

    return `Mets live game: ${away} ${awayScore} vs ${home} ${homeScore}, ${inningState} ${inning}, ${outs} out${outs !== 1 ? "s" : ""}.`;
  } catch (err) {
    console.error("[admin-ai-assistant] MLB live game fetch failed:", err);
    return "";
  }
}

async function fetchMetsStandings(): Promise<string> {
  try {
    const res = await fetch(
      `${MLB_STATS_API}/standings?leagueId=104&division=201&season=2026&standingsTypes=regularSeason`,
      { headers: { "Cache-Control": "no-cache, no-store" } }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const records = data?.records?.[0]?.teamRecords ?? [];
    const mets = records.find((r: any) => r.team?.id === METS_TEAM_ID);
    if (!mets) return "";
    return `Mets 2026 NL East standing: ${mets.divisionRank || "-"}, ${mets.wins}-${mets.losses}, ${mets.gamesBack || "0"} GB.`;
  } catch (err) {
    console.error("[admin-ai-assistant] MLB standings fetch failed:", err);
    return "";
  }
}

function needsLiveStats(messages: { role: string; content: string }[]): boolean {
  const text = messages.map((m) => m.content).join(" ").toLowerCase();
  const keywords = [
    "live game", "score", "standings", "today's game", "tonight's game",
    "current score", "inning", "mets game", "who won", "mlb stats",
    "player stats", "recent game", "last game",
  ];
  return keywords.some((k) => text.includes(k));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate and enforce admin-only access
    const authHeader = req.headers.get("authorization");
    const apikey = req.headers.get("apikey") || req.headers.get("x-client-info");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { messages?: { role: string; content: string }[] } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0 || messages.length > 50) {
      return new Response(JSON.stringify({ error: "Between 1 and 50 messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = new Set(["system", "user", "assistant"]);
    for (const m of messages) {
      if (
        !m || typeof m !== "object" ||
        !validRoles.has(m.role) ||
        typeof m.content !== "string" ||
        m.content.length > 8000
      ) {
        return new Response(JSON.stringify({ error: "Each message must have a valid role and content under 8000 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Gather live MLB context when the conversation touches current games/stats
    let liveContext = "";
    if (needsLiveStats(messages)) {
      const [game, standings] = await Promise.all([
        fetchMetsLiveGame(),
        fetchMetsStandings(),
      ]);
      liveContext = [game, standings].filter(Boolean).join("\n");
    }

    const systemPrompt = `You are the MetsXMFanZone Admin AI Assistant — a sharp, brand-aware helper for the site's owner and admins.

Brand voice: passionate Mets fan, direct, energetic, SNY-style when writing content. Keep answers concise and actionable.

You can help with:
- Writing Mets blog posts and SNY-style news updates
- Writing podcast scripts, intros, and talking points
- Content ideas for the website, social media, and community
- Answering questions about the admin portal and site features

When writing blog posts, include a catchy headline and body copy ready to paste into the Blog Management page.
When writing podcast scripts, include an intro hook, segment outline, and outro.
When suggesting content ideas, return a numbered list with angles and platforms.
${liveContext ? "\nLive MLB context (use only if relevant):\n" + liveContext : ""}

Do not make up player transactions, injuries, or rumors unless they appear in the live context above. If you don't know something, say so.`;

    const gatewayMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const aiRes = await callCloudflareAi({
      messages: gatewayMessages,
      stream: true,
    });

    if (!aiRes.ok) {
      return cloudflareAiErrorResponse(aiRes.status, "AI service unavailable. Please try again shortly.", corsHeaders);
    }

    return new Response(transformCloudflareStreamToOpenAi(aiRes), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[admin-ai-assistant] error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
