import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getPlayerImageUrl(playerId: number): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

interface PlayerStats {
  name: string;
  id: number;
  position: string;
  is_pitcher: boolean;
  // Hitter stats
  avg?: string;
  hr?: number;
  rbi?: number;
  runs?: number;
  sb?: number;
  ops?: string;
  hits?: number;
  ab?: number;
  // Pitcher stats
  era?: string;
  strikeouts?: number;
  wins?: number;
  losses?: number;
  innings_pitched?: string;
  saves?: number;
  walks_allowed?: number;
  hr_allowed?: number;
  whip?: string;
}

async function fetchPlayerStats(playerId: number, playerName: string, position: string): Promise<PlayerStats | null> {
  const isPitcher = ["SP", "CL", "RP", "P"].includes(position);
  const group = isPitcher ? "pitching" : "hitting";
  const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[${group}],type=[season],season=2026)`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const person = data.people?.[0];
    if (!person) return null;

    const stats = person.stats?.[0]?.splits?.[0]?.stat;

    if (isPitcher) {
      return {
        name: playerName,
        id: playerId,
        position,
        is_pitcher: true,
        era: stats?.era ?? "-",
        strikeouts: stats?.strikeOuts ?? 0,
        wins: stats?.wins ?? 0,
        losses: stats?.losses ?? 0,
        innings_pitched: stats?.inningsPitched ?? "0.0",
        saves: stats?.saves ?? 0,
        walks_allowed: stats?.baseOnBalls ?? 0,
        hr_allowed: stats?.homeRuns ?? 0,
        whip: stats?.whip ?? "-",
      };
    } else {
      return {
        name: playerName,
        id: playerId,
        position,
        is_pitcher: false,
        avg: stats?.avg ?? ".000",
        hr: stats?.homeRuns ?? 0,
        rbi: stats?.rbi ?? 0,
        runs: stats?.runs ?? 0,
        sb: stats?.stolenBases ?? 0,
        ops: stats?.ops ?? ".000",
        hits: stats?.hits ?? 0,
        ab: stats?.atBats ?? 0,
      };
    }
  } catch (e) {
    console.error(`Failed to fetch stats for ${playerName} (${playerId}):`, e);
    return null;
  }
}

function generateDescription(stats: PlayerStats, opponent?: string): string {
  const vs = opponent ? ` vs ${opponent}` : "";
  if (stats.is_pitcher) {
    const era = stats.era !== "-" ? `${stats.era} ERA` : "no ERA yet";
    const k = stats.strikeouts ?? 0;
    const record = `${stats.wins ?? 0}-${stats.losses ?? 0}`;
    return `${stats.name} takes the mound${vs} with a ${era} and ${k} K's on the season (${record}). ${stats.whip !== "-" ? `WHIP: ${stats.whip}.` : ""}`;
  } else {
    const avg = stats.avg !== ".000" ? stats.avg : "-";
    const hr = stats.hr ?? 0;
    const rbi = stats.rbi ?? 0;
    const ops = stats.ops !== ".000" ? stats.ops : "-";
    return `${stats.name} is batting ${avg} with ${hr} HR and ${rbi} RBI${vs}. OPS: ${ops}. ${hr > 5 ? "Power surge!" : rbi > 15 ? "Run producer!" : stats.sb && stats.sb > 3 ? "Speed threat on the bases." : "Looking to make an impact."}`;
  }
}

function determineStatus(stats: PlayerStats): "hot" | "cold" {
  if (stats.is_pitcher) {
    const era = parseFloat(stats.era ?? "9");
    if (isNaN(era)) return "hot"; // No ERA = new/fresh
    return era <= 3.50 ? "hot" : "cold";
  } else {
    const avg = parseFloat(stats.avg ?? ".000");
    const ops = parseFloat(stats.ops ?? ".000");
    if (isNaN(avg) || avg === 0) return "hot"; // No stats yet = benefit of the doubt
    return (avg >= 0.270 || ops >= 0.800) ? "hot" : "cold";
  }
}

function calculateConfidence(stats: PlayerStats): number {
  if (stats.is_pitcher) {
    const era = parseFloat(stats.era ?? "9");
    const ip = parseFloat(stats.innings_pitched ?? "0");
    if (isNaN(era) || ip < 5) return 55; // Not enough data
    if (era <= 2.5) return 90;
    if (era <= 3.5) return 80;
    if (era <= 4.5) return 65;
    return 55;
  } else {
    const avg = parseFloat(stats.avg ?? ".000");
    const ops = parseFloat(stats.ops ?? ".000");
    const ab = stats.ab ?? 0;
    if (ab < 10) return 55; // Not enough data
    if (ops >= 0.900) return 90;
    if (ops >= 0.800) return 80;
    if (avg >= 0.280) return 75;
    if (avg >= 0.250) return 65;
    return 55;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let forceRegenerate = false;
    let triggerType = "manual";
    let lineupPlayerIds: number[] = [];
    let lineupPlayers: Array<{ name: string; id: number; position: string }> = [];
    let opponent = "";

    try {
      const body = await req.json();
      if (body.forceRegenerate === true) forceRegenerate = true;
      if (body.triggerType) triggerType = body.triggerType;
      if (body.triggeredBy) triggerType = body.triggeredBy;
      if (body.lineupPlayerIds && Array.isArray(body.lineupPlayerIds)) lineupPlayerIds = body.lineupPlayerIds;
      if (body.lineupPlayers && Array.isArray(body.lineupPlayers)) lineupPlayers = body.lineupPlayers;
      if (body.opponent) opponent = body.opponent;
      if (body.forceStarPlayers && Array.isArray(body.forceStarPlayers)) {
        // Treat star player IDs as lineup player IDs for manual override
        lineupPlayerIds = [...lineupPlayerIds, ...body.forceStarPlayers];
      }
    } catch { /* defaults */ }

    const today = new Date().toISOString().split("T")[0];

    // Check for existing predictions
    const { data: existingPredictions } = await supabase
      .from("daily_player_predictions")
      .select("*")
      .eq("prediction_date", today);

    if (existingPredictions && existingPredictions.length > 0 && !forceRegenerate) {
      return new Response(
        JSON.stringify({ message: "Predictions already exist for today", predictions: existingPredictions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (forceRegenerate && existingPredictions && existingPredictions.length > 0) {
      await supabase.from("daily_player_predictions").delete().eq("prediction_date", today);
    }

    // If no lineup players provided, try to pull from today's lineup card
    if (lineupPlayers.length === 0 && lineupPlayerIds.length === 0) {
      console.log("No lineup data provided, fetching from today's lineup card...");
      const { data: lineupCard } = await supabase
        .from("lineup_cards")
        .select("*")
        .eq("game_date", today)
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lineupCard) {
        opponent = lineupCard.opponent || opponent;
        const lineupData = lineupCard.lineup_data as any;
        const startingPitcher = lineupCard.starting_pitcher as any;

        // Extract batters from lineup_data
        if (Array.isArray(lineupData)) {
          for (const player of lineupData) {
            if (player.playerId || player.id) {
              lineupPlayers.push({
                name: player.name || player.fullName || "Unknown",
                id: player.playerId || player.id,
                position: player.position || player.pos || "IF",
              });
            }
          }
        }

        // Add starting pitcher
        if (startingPitcher && (startingPitcher.playerId || startingPitcher.id)) {
          lineupPlayers.push({
            name: startingPitcher.name || startingPitcher.fullName || "Unknown",
            id: startingPitcher.playerId || startingPitcher.id,
            position: "SP",
          });
        }

        console.log(`Pulled ${lineupPlayers.length} players from today's lineup card vs ${opponent}`);
      } else {
        console.log("No lineup card found for today");
        return new Response(
          JSON.stringify({ error: "No lineup card found for today. Post a lineup card first, then generate predictions." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Deduplicate by ID
    const uniquePlayers = lineupPlayers.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
    console.log(`Fetching real MLB stats for ${uniquePlayers.length} players...`);

    // Fetch real stats from MLB API for all players in parallel
    const statsPromises = uniquePlayers.map(p => fetchPlayerStats(p.id, p.name, p.position));
    const allStats = await Promise.all(statsPromises);
    const validStats = allStats.filter((s): s is PlayerStats => s !== null);

    console.log(`Got stats for ${validStats.length} of ${uniquePlayers.length} players`);

    if (validStats.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not fetch stats for any players. The MLB API may be unavailable." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cleanup old predictions (older than 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    await supabase.from("daily_player_predictions").delete().lt("prediction_date", weekAgo.toISOString().split("T")[0]);

    // Build predictions from real stats
    const predictionsToInsert = validStats.map(stats => ({
      player_name: stats.name,
      player_id: stats.id,
      player_image_url: getPlayerImageUrl(stats.id),
      status: determineStatus(stats),
      description: generateDescription(stats, opponent || undefined),
      prediction_date: today,
      is_pitcher: stats.is_pitcher,
      confidence: calculateConfidence(stats),
      predicted_hr: stats.is_pitcher ? (stats.hr_allowed ?? 0) : (stats.hr ?? 0),
      predicted_rbis: stats.is_pitcher ? 0 : (stats.rbi ?? 0),
      predicted_runs: stats.is_pitcher ? 0 : (stats.runs ?? 0),
      predicted_sb: stats.is_pitcher ? 0 : (stats.sb ?? 0),
      predicted_strikeouts: stats.is_pitcher ? (stats.strikeouts ?? 0) : 0,
      predicted_innings_pitched: stats.is_pitcher ? parseFloat(stats.innings_pitched ?? "0") : 0,
      predicted_saves: stats.is_pitcher ? (stats.saves ?? 0) : 0,
      predicted_win_loss: stats.is_pitcher ? `${stats.wins ?? 0}-${stats.losses ?? 0}` : null,
      predicted_walks: stats.is_pitcher ? 0 : 0,
      predicted_walks_allowed: stats.is_pitcher ? (stats.walks_allowed ?? 0) : 0,
      predicted_hr_allowed: stats.is_pitcher ? (stats.hr_allowed ?? 0) : 0,
    }));

    const { data: insertedPredictions, error: insertError } = await supabase
      .from("daily_player_predictions")
      .insert(predictionsToInsert)
      .select();

    if (insertError) throw insertError;

    console.log(`Successfully generated ${insertedPredictions?.length} stat-based predictions (trigger: ${triggerType})`);

    return new Response(
      JSON.stringify({ message: `Predictions generated from real MLB stats for ${insertedPredictions?.length} players`, triggerType, predictions: insertedPredictions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating predictions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
