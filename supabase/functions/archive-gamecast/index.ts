import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METS_TEAM_ID = 121;
const FINAL_STATES = ["Final", "Game Over", "Completed Early"];

const todayET = (): string =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/New_York" }).slice(0, 10);

const yesterdayET = (): string => {
  const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  ny.setDate(ny.getDate() - 1);
  return ny.toISOString().slice(0, 10);
};

async function fetchMetsGames(date: string) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&date=${date}&hydrate=linescore,decisions,team,venue`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB schedule ${res.status}`);
  const data = await res.json();
  return data.dates?.[0]?.games ?? [];
}

async function fetchLiveFeed(gamePk: number) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`);
  if (!res.ok) throw new Error(`MLB live ${res.status}`);
  return res.json();
}

function shortenTeamName(full: string): string {
  return full
    .replace("New York ", "")
    .replace("Atlanta ", "")
    .replace("Philadelphia ", "")
    .replace("Miami ", "")
    .replace("Washington ", "")
    .replace("Los Angeles ", "")
    .replace("San Francisco ", "")
    .replace("San Diego ", "")
    .replace("St. Louis ", "");
}

async function archiveGame(supabase: any, game: any) {
  const gamePk = game.gamePk;
  const isHome = game.teams.home.team.id === METS_TEAM_ID;
  const opponent = shortenTeamName(
    isHome ? game.teams.away.team.name : game.teams.home.team.name
  );
  const metsScore = isHome ? game.teams.home.score : game.teams.away.score;
  const oppScore = isHome ? game.teams.away.score : game.teams.home.score;
  const result = metsScore > oppScore ? "W" : metsScore < oppScore ? "L" : "T";

  const feed = await fetchLiveFeed(gamePk);
  const allPlays = (feed?.liveData?.plays?.allPlays ?? []).filter(
    (p: any) => p.about?.isComplete
  );
  const decisions = feed?.liveData?.decisions ?? {};
  const linescore = feed?.liveData?.linescore ?? game.linescore ?? null;
  const boxscore = feed?.liveData?.boxscore ?? null;

  const row = {
    game_pk: gamePk,
    game_date: game.gameDate?.slice(0, 10) ?? todayET(),
    opponent,
    home_away: isHome ? "home" : "away",
    mets_score: metsScore,
    opponent_score: oppScore,
    result,
    venue: game.venue?.name ?? null,
    winning_pitcher: decisions?.winner?.fullName ?? null,
    losing_pitcher: decisions?.loser?.fullName ?? null,
    save_pitcher: decisions?.save?.fullName ?? null,
    status: game.status?.detailedState ?? null,
    plays: allPlays,
    linescore,
    boxscore,
    decisions,
  };

  const { data, error } = await supabase
    .from("gamecast_archives")
    .upsert(row, { onConflict: "game_pk" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let date = yesterdayET();
    let gamePk: number | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.date) date = body.date;
      if (body?.gamePk) gamePk = Number(body.gamePk);
    } else {
      const u = new URL(req.url);
      if (u.searchParams.get("date")) date = u.searchParams.get("date")!;
      if (u.searchParams.get("gamePk")) gamePk = Number(u.searchParams.get("gamePk"));
    }

    const archived: any[] = [];

    if (gamePk) {
      const sched = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePk=${gamePk}&hydrate=linescore,decisions,team,venue`
      ).then((r) => r.json());
      const game = sched.dates?.[0]?.games?.[0];
      if (!game) throw new Error(`Game ${gamePk} not found`);
      if (!FINAL_STATES.includes(game.status?.detailedState))
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "not final", gamePk }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      archived.push(await archiveGame(supabase, game));
    } else {
      const games = await fetchMetsGames(date);
      const finished = games.filter((g: any) =>
        FINAL_STATES.includes(g.status?.detailedState)
      );
      for (const g of finished) {
        try {
          archived.push(await archiveGame(supabase, g));
        } catch (e: any) {
          console.error("archive error", g.gamePk, e?.message);
          archived.push({ game_pk: g.gamePk, error: e?.message });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, date, archived }), {
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
