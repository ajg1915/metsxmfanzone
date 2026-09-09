import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateCloudflareText } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METS_TEAM_ID = 121;

const yesterdayET = (): string => {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  ny.setDate(ny.getDate() - 1);
  return ny.toISOString().slice(0, 10);
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);

async function fetchMetsGames(date: string) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&date=${date}&hydrate=linescore,decisions,team,venue,probablePitcher`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB API ${res.status}`);
  const data = await res.json();
  return data.dates?.[0]?.games ?? [];
}

async function fetchBoxScore(gamePk: number) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`);
  if (!res.ok) return null;
  return res.json();
}

async function generateRecapBody(context: any): Promise<{ title: string; summary: string; body: string }> {
  const prompt = `You are a Mets beat writer for MetsXMFanZone. Write a sharp, fan-focused recap of last night's Mets game.

GAME CONTEXT (JSON):
${JSON.stringify(context, null, 2)}

Output STRICT JSON with this exact shape (no markdown fences):
{
  "title": "Catchy headline under 80 chars including final score",
  "summary": "1-2 sentence TL;DR (max 200 chars)",
  "body": "<p>...</p> ...HTML body 350-500 words. Use <p>, <strong>, <h3> only. Cover key moments, standout players, pitching, and what's next."
}`;

    const text = await generateCloudflareText({
      messages: [
        { role: "system", content: "You write concise, accurate MLB recaps. ALWAYS respond with ONLY a raw JSON object. No markdown, no explanation, no prose." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim() || "{}";
    try {
      return JSON.parse(cleaned);
    } catch (parseErr) {
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
      throw parseErr;
    }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let date = yesterdayET();
    let force = false;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.date) date = body.date;
      force = !!body?.force;
    } else {
      const u = new URL(req.url);
      if (u.searchParams.get("date")) date = u.searchParams.get("date")!;
      force = u.searchParams.get("force") === "true";
    }

    const games = await fetchMetsGames(date);
    const finished = games.filter((g: any) =>
      ["Final", "Game Over", "Completed Early"].includes(g.status?.detailedState)
    );

    if (finished.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: `No finished Mets games on ${date}`, date }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const created: any[] = [];

    for (const game of finished) {
      const isHome = game.teams.home.team.id === METS_TEAM_ID;
      const opponent = (isHome ? game.teams.away.team.name : game.teams.home.team.name)
        .replace("New York ", "")
        .replace("Atlanta ", "")
        .replace("Philadelphia ", "")
        .replace("Miami ", "")
        .replace("Washington ", "");
      const metsScore = isHome ? game.teams.home.score : game.teams.away.score;
      const oppScore = isHome ? game.teams.away.score : game.teams.home.score;
      const result = metsScore > oppScore ? "W" : metsScore < oppScore ? "L" : "T";
      const slug = slugify(`mets-${result === "W" ? "beat" : result === "L" ? "fall-to" : "tie"}-${opponent}-${date}-${game.gamePk}`);

      // Skip if already exists (unless force)
      if (!force) {
        const { data: existing } = await supabase
          .from("game_recaps")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (existing) {
          created.push({ slug, skipped: true });
          continue;
        }
      }

      const feed = await fetchBoxScore(game.gamePk);
      const decisions = feed?.liveData?.decisions ?? game.decisions ?? {};
      const linescore = feed?.liveData?.linescore ?? game.linescore ?? {};
      const boxStars = feed?.liveData?.boxscore?.teams ?? {};

      const context = {
        date,
        opponent,
        venue: game.venue?.name,
        homeAway: isHome ? "home" : "away",
        finalScore: { mets: metsScore, opponent: oppScore, result },
        winningPitcher: decisions?.winner?.fullName,
        losingPitcher: decisions?.loser?.fullName,
        save: decisions?.save?.fullName,
        innings: linescore?.innings?.map((i: any) => ({
          inning: i.num,
          home: i.home?.runs,
          away: i.away?.runs,
        })),
        teamHits: {
          mets: isHome ? linescore?.teams?.home?.hits : linescore?.teams?.away?.hits,
          opponent: isHome ? linescore?.teams?.away?.hits : linescore?.teams?.home?.hits,
        },
        topMetsBatters: Object.values((isHome ? boxStars.home : boxStars.away)?.players ?? {})
          .map((p: any) => ({
            name: p.person?.fullName,
            stats: p.stats?.batting,
          }))
          .filter((p: any) => p.stats?.atBats > 0)
          .slice(0, 6),
      };

      const ai = await generateRecapBody(context);

      const heroImageUrl = `https://www.mlbstatic.com/team-logos/${METS_TEAM_ID}.svg`;

      const insertRow = {
        title: ai.title || `Mets ${result === "W" ? "beat" : "fall to"} ${opponent} ${metsScore}-${oppScore}`,
        slug,
        opponent,
        game_date: date,
        home_away: isHome ? "home" : "away",
        mets_score: metsScore,
        opponent_score: oppScore,
        result,
        summary: ai.summary || null,
        body: ai.body || null,
        hero_image_url: heroImageUrl,
        status: "published",
        published_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("game_recaps")
        .upsert(insertRow, { onConflict: "slug" })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        created.push({ slug, error: error.message });
      } else {
        created.push({ slug, id: data.id });
      }
    }

    return new Response(JSON.stringify({ ok: true, date, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
