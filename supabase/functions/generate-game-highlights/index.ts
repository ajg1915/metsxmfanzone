// Generates concise text highlights for a finished MLB game on demand.
// Input: { gamePk: number, gameDate?: string (YYYY-MM-DD) }
// Stores result in public.game_recaps and returns { highlights: string[] }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCloudflareText } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROFANITY =
  /\b(fuck|shit|bitch|asshole|cunt|nigger|faggot|dick|pussy|slut|whore)\b/i;
const PII =
  /(\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|[\w.+-]+@[\w-]+\.[\w.-]+|https?:\/\/\S+)/i;

const safe = (s: string) => !PROFANITY.test(s) && !PII.test(s);

async function generateWithAI(context: string): Promise<string[]> {
  try {
    const text = await generateCloudflareText({
      messages: [
        {
          role: "system",
          content:
            "You write short MLB game text highlights. Return JSON only: {\"highlights\":[\"...\",\"...\"]}. 4-6 bullets, each <= 140 chars, factual, no profanity, no personal info, no URLs, no hashtags.",
        },
        { role: "user", content: context },
      ],
      temperature: 0.6,
    });
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const arr = Array.isArray(parsed.highlights) ? parsed.highlights : [];
      return arr.map((s: unknown) => String(s).trim()).filter((s: string) => s && safe(s)).slice(0, 6);
    } catch {
      return text
        .split(/\n+/)
        .map((l) => l.replace(/^[-*•\d.\s]+/, "").trim())
        .filter((l) => l.length > 0 && safe(l))
        .slice(0, 6);
    }
  } catch {
    return [];
  }
}

function fallbackHighlights(feed: any): string[] {
  const lines: string[] = [];
  try {
    const plays = feed?.liveData?.plays?.scoringPlays ?? [];
    const allPlays = feed?.liveData?.plays?.allPlays ?? [];
    for (const idx of plays) {
      const p = allPlays[idx];
      const desc = p?.result?.description;
      if (desc) lines.push(desc.replace(/\s+/g, " ").trim().slice(0, 200));
      if (lines.length >= 6) break;
    }
  } catch { /* ignore */ }
  return lines.filter(safe);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { gamePk, gameDate } = await req.json();
    if (!gamePk) {
      return new Response(JSON.stringify({ error: "gamePk required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check cache first
    if (gameDate) {
      const { data: existing } = await supabase
        .from("game_recaps")
        .select("highlights")
        .eq("game_date", gameDate)
        .maybeSingle();
      const cached = (existing as any)?.highlights;
      if (Array.isArray(cached) && cached.length > 0) {
        return new Response(JSON.stringify({ highlights: cached, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Pull MLB live feed
    const feedRes = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
    );
    if (!feedRes.ok) {
      return new Response(JSON.stringify({ error: "feed unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const feed = await feedRes.json();
    const state = feed?.gameData?.status?.abstractGameState;
    if (state !== "Final") {
      return new Response(JSON.stringify({ highlights: [], notFinal: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const home = feed?.gameData?.teams?.home?.name ?? "Home";
    const away = feed?.gameData?.teams?.away?.name ?? "Away";
    const homeScore = feed?.liveData?.linescore?.teams?.home?.runs ?? 0;
    const awayScore = feed?.liveData?.linescore?.teams?.away?.runs ?? 0;
    const scoringDescriptions = fallbackHighlights(feed);

    const context =
      `Final: ${away} ${awayScore} @ ${home} ${homeScore}.\nDate: ${gameDate ?? ""}\nScoring plays:\n` +
      scoringDescriptions.map((d, i) => `${i + 1}. ${d}`).join("\n");

    let highlights = await generateWithAI(context);
    if (highlights.length === 0) highlights = scoringDescriptions.slice(0, 6);

    // Upsert recap
    if (gameDate) {
      const metsIsHome = home.includes("Mets");
      const mets = metsIsHome ? homeScore : awayScore;
      const opp = metsIsHome ? awayScore : homeScore;
      await supabase.from("game_recaps").upsert(
        {
          game_date: gameDate,
          opponent: metsIsHome ? away : home,
          home_away: metsIsHome ? "home" : "away",
          mets_score: mets,
          opponent_score: opp,
          result: mets > opp ? "W" : mets < opp ? "L" : "T",
          highlights,
          status: "published",
          title: `Mets ${mets > opp ? "beat" : "fall to"} ${metsIsHome ? away : home}`,
          slug: `mets-${gameDate}-${gamePk}`,
          published_at: new Date().toISOString(),
        },
        { onConflict: "slug" },
      );
    }

    return new Response(JSON.stringify({ highlights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
