import { createClient } from "npm:@supabase/supabase-js@2";

// Stats-based daily predictions — no AI, no quota.
// Uses real MLB season + last-7-game stats for each player in today's lineup.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METS_TEAM_ID = 121;
const SEASON = 2026;
const RECENT_GAMES = 7;
const HITTERS_TO_PICK = 5;

type Player = { name: string; id: number; position: string };

const getTodayET = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

const headshot = (id: number) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${id}/headshot/67/current`;

const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const blend = (season: number, recent: number) => 0.6 * season + 0.4 * recent;
// "145.2" innings → 145.667
const parseIP = (ip: unknown) => {
  const [whole, frac] = String(ip ?? "0").split(".");
  return num(whole) + num(frac) / 3;
};
const lastName = (name: string) => name.split(" ").slice(-1)[0].replace(/\.$/, "") === "Jr"
  ? name.split(" ").slice(-2, -1)[0]
  : name.split(" ").slice(-1)[0];

async function getStats(id: number, group: "hitting" | "pitching") {
  const limit = group === "pitching" ? 3 : RECENT_GAMES;
  const url = `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season,lastXGames&group=${group}&season=${SEASON}&limit=${limit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MLB stats ${res.status}`);
    const json = await res.json();
    let season: any = {};
    let recent: any = {};
    for (const s of json?.stats ?? []) {
      const type = s?.type?.displayName;
      const stat = s?.splits?.[0]?.stat ?? {};
      if (type === "season") season = stat;
      if (type === "lastXGames") recent = stat;
    }
    return { season, recent };
  } catch (e) {
    console.warn(`Stats fetch failed for ${id}:`, e);
    return { season: {}, recent: {} };
  }
}

function hitterPrediction(p: Player, season: any, recent: any) {
  const sG = Math.max(num(season.gamesPlayed), 1);
  const rG = Math.max(num(recent.gamesPlayed), 1);
  const hasRecent = num(recent.gamesPlayed) > 0;
  const rate = (key: string) => {
    const s = num(season[key]) / sG;
    const r = hasRecent ? num(recent[key]) / rG : s;
    return blend(s, r);
  };

  const hrRate = rate("homeRuns");
  const rbiRate = rate("rbi");
  const runRate = rate("runs");
  const sbRate = rate("stolenBases");
  const bbRate = rate("baseOnBalls");

  const seasonOps = num(season.ops, 0.7);
  const recentOps = hasRecent ? num(recent.ops, seasonOps) : seasonOps;
  const hot = recentOps >= seasonOps;
  const diff = recentOps - seasonOps;
  const confidence = Math.round(clamp(62 + diff * 100 + (seasonOps - 0.7) * 50, 50, 95));

  const rHits = num(recent.hits);
  const rAB = num(recent.atBats);
  const rHR = num(recent.homeRuns);
  const recentLine = hasRecent
    ? `${rHits}-for-${rAB}${rHR > 0 ? ` with ${rHR} HR` : ""} over his last ${num(recent.gamesPlayed)}`
    : `hitting ${season.avg ?? "—"} on the season`;
  const ln = lastName(p.name);
  const description = hot
    ? `${ln} is ${recentLine} (${recent.ops ?? season.ops ?? "—"} OPS) — hot bat, lean over on total bases.`
    : `${ln} has cooled off, ${recentLine} (${recent.ops ?? "—"} OPS vs ${season.ops ?? "—"} season). Fade his props today.`;

  return {
    status: hot ? "hot" : "cold",
    is_pitcher: false,
    description,
    confidence,
    predicted_hr: hrRate >= 0.2 ? 1 : 0,
    predicted_rbis: clamp(Math.round(rbiRate), 0, 5),
    predicted_runs: clamp(Math.round(runRate), 0, 3),
    predicted_sb: sbRate >= 0.25 ? 1 : 0,
    predicted_walks: clamp(Math.round(bbRate), 0, 3),
    predicted_strikeouts: 0,
    predicted_innings_pitched: 0,
    predicted_saves: 0,
    predicted_win_loss: null,
    predicted_walks_allowed: 0,
    predicted_hr_allowed: 0,
  };
}

function pitcherPrediction(p: Player, season: any, recent: any) {
  // Divide by appearances (not starts) so relief outings don't inflate per-game rates
  const sGS = Math.max(num(season.gamesPlayed), 1);
  const rGS = Math.max(num(recent.gamesPlayed), 1);
  const hasRecent = num(recent.gamesPlayed) > 0;
  const per = (key: string) => {
    const s = num(season[key]) / sGS;
    const r = hasRecent ? num(recent[key]) / rGS : s;
    return blend(s, r);
  };
  const ipPer = blend(parseIP(season.inningsPitched) / sGS, hasRecent ? parseIP(recent.inningsPitched) / rGS : parseIP(season.inningsPitched) / sGS);

  const seasonEra = num(season.era, 4.2);
  const recentEra = hasRecent ? num(recent.era, seasonEra) : seasonEra;
  const hot = recentEra <= seasonEra;
  const confidence = Math.round(clamp(62 + (seasonEra - recentEra) * 6 + (4.2 - seasonEra) * 5, 50, 95));
  const ks = clamp(Math.round(per("strikeOuts")), 0, 12);
  // Round to nearest out, store in baseball notation (5.2 = 5 and 2/3 innings)
  const outs = clamp(Math.round(ipPer * 3), 0, 27);
  const ip = Math.floor(outs / 3) + (outs % 3) / 10;
  const ln = lastName(p.name);

  const description = hot
    ? `${ln} carries a ${recent.era ?? season.era ?? "—"} ERA over his last ${num(recent.gamesPlayed) || "few"} outings. Look for ~${ks} Ks — lean over on strikeouts.`
    : `${ln}'s ERA is ${recent.era ?? "—"} lately vs ${season.era ?? "—"} on the season. Lean under on his strikeout line.`;

  return {
    status: hot ? "hot" : "cold",
    is_pitcher: true,
    description,
    confidence,
    predicted_hr: 0,
    predicted_rbis: 0,
    predicted_runs: 0,
    predicted_sb: 0,
    predicted_walks: 0,
    predicted_strikeouts: ks,
    predicted_innings_pitched: ip,
    predicted_saves: 0,
    predicted_win_loss: seasonEra <= 3.9 || hot ? "W" : "L",
    predicted_walks_allowed: clamp(Math.round(per("baseOnBalls")), 0, 5),
    predicted_hr_allowed: clamp(Math.round(per("homeRuns")), 0, 3),
  };
}

// Used when called without lineup data (manual/admin run): read today's lineup card
async function loadLineupFromDb(supabase: any, date: string): Promise<Player[]> {
  const { data: card } = await supabase
    .from("lineup_cards")
    .select("lineup_data")
    .eq("game_date", date)
    .maybeSingle();
  const players: Player[] = [];
  for (const p of (card?.lineup_data ?? []) as any[]) {
    const m = String(p?.imageUrl ?? "").match(/\/people\/(\d+)\//);
    if (m) players.push({ name: p.name, id: parseInt(m[1]), position: p.fieldPosition || "DH" });
  }
  // Probable pitcher from MLB schedule
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&date=${date}&hydrate=probablePitcher`);
    const json = await res.json();
    const game = json?.dates?.[0]?.games?.[0];
    if (game) {
      const mets = game.teams.home.team.id === METS_TEAM_ID ? game.teams.home : game.teams.away;
      const pp = mets?.probablePitcher;
      if (pp?.id) players.push({ name: pp.fullName, id: pp.id, position: "SP" });
    }
  } catch (e) {
    console.warn("Probable pitcher lookup failed:", e);
  }
  return players;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let body: any = {};
    try { body = await req.json(); } catch { /* defaults */ }
    const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : getTodayET();
    const forceRegenerate = body.forceRegenerate === true;
    const forceStarPlayers: number[] = Array.isArray(body.forceStarPlayers) ? body.forceStarPlayers : [];
    const triggerType = body.triggeredBy ?? body.triggerType ?? "manual";

    const { data: existing } = await supabase
      .from("daily_player_predictions")
      .select("*")
      .eq("prediction_date", date);

    if (existing && existing.length > 0 && !forceRegenerate && forceStarPlayers.length === 0) {
      return new Response(JSON.stringify({ message: "Predictions already exist for today", predictions: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let pool: Player[] = Array.isArray(body.lineupPlayers) && body.lineupPlayers.length > 0
      ? body.lineupPlayers
      : await loadLineupFromDb(supabase, date);
    // de-dupe by id
    pool = pool.filter((p, i, arr) => p?.id && arr.findIndex((x) => x.id === p.id) === i);

    if (pool.length === 0) {
      return new Response(JSON.stringify({ message: "No lineup posted yet — skipping predictions", action: "skipped" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pitcher = pool.find((p) => p.position === "SP");
    const hitters = pool.filter((p) => p.position !== "SP");
    const forced = hitters.filter((p) => forceStarPlayers.includes(p.id));
    const rest = hitters.filter((p) => !forceStarPlayers.includes(p.id)).sort(() => 0.5 - Math.random());
    const selected: Player[] = [...forced, ...rest].slice(0, HITTERS_TO_PICK);
    if (pitcher) selected.push(pitcher);

    const rows = await Promise.all(selected.map(async (p) => {
      const isPitcher = p.position === "SP";
      const { season, recent } = await getStats(p.id, isPitcher ? "pitching" : "hitting");
      const pred = isPitcher ? pitcherPrediction(p, season, recent) : hitterPrediction(p, season, recent);
      return {
        player_name: p.name,
        player_id: p.id,
        player_image_url: headshot(p.id),
        prediction_date: date,
        bet_amount: "$10",
        payout: `$${Math.floor(Math.random() * 476) + 25}`,
        ...pred,
      };
    }));

    // Replace any existing rows for the date (prevents duplicates)
    await supabase.from("daily_player_predictions").delete().eq("prediction_date", date);

    const { data: inserted, error } = await supabase.from("daily_player_predictions").insert(rows).select();
    if (error) throw error;

    // Cleanup predictions older than a week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    await supabase.from("daily_player_predictions").delete().lt("prediction_date", weekAgo.toISOString().split("T")[0]);

    console.log(`Generated ${inserted?.length} stats-based predictions for ${date} (trigger: ${triggerType})`);
    return new Response(JSON.stringify({ message: "Predictions generated successfully", source: "mlb-stats", triggerType, predictions: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error generating predictions:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
