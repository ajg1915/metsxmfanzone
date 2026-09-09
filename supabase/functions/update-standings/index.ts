import { createClient } from "npm:@supabase/supabase-js@2";
import { generateCloudflareText } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate secret token for security (prevents unauthorized calls)
    const authHeader = req.headers.get("Authorization");
    const expectedToken = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!authHeader || !authHeader.includes(expectedToken || "")) {
      console.error("Unauthorized: Invalid or missing authorization");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });

    console.log(`Updating standings for ${today}`);

    const prompt = `Generate current NL East standings and Mets team leaders for ${today}.

Return ONLY valid JSON in this exact format (no markdown fences, no extra text):
{
  "standings": [
    {"team_name": "Mets", "wins": 45, "losses": 32, "games_back": "-", "position": 1},
    {"team_name": "Braves", "wins": 43, "losses": 34, "games_back": "2.0", "position": 2}
  ],
  "leaders": [
    {"category": "AVG", "player_name": "Player Name", "stat_value": ".300"},
    {"category": "HR", "player_name": "Player Name", "stat_value": "25"},
    {"category": "RBI", "player_name": "Player Name", "stat_value": "60"}
  ]
}

Include all 5 NL East teams: Mets, Braves, Phillies, Marlins, Nationals.
Make the stats realistic for mid-season (around 77 games played).
The Mets should be competitive but standings can vary.`;

    const aiText = await generateCloudflareText({
      messages: [
        {
          role: "system",
          content: `You are a sports data assistant. Provide realistic MLB NL East division standings and Mets team leaders.
Since this is for a 2026 season simulation, generate plausible standings data that changes slightly each day.
ALWAYS respond with ONLY the exact JSON object requested. No markdown, no explanation, no prose.`,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
    });

    const cleaned = aiText.replace(/^```json\s*|\s*```$/g, "").trim();
    let data: any;
    try {
      data = JSON.parse(cleaned);
    } catch (parseErr) {
      // Try to extract the first JSON object from the response
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          data = JSON.parse(objectMatch[0]);
        } catch {
          throw parseErr;
        }
      } else {
        throw parseErr;
      }
    }
    console.log("Parsed standings data:", JSON.stringify(data, null, 2));

    // Update standings in database
    for (const standing of data.standings) {
      const { error: standingError } = await supabase
        .from("team_standings")
        .update({
          wins: standing.wins,
          losses: standing.losses,
          games_back: standing.games_back,
          position: standing.position,
          updated_at: new Date().toISOString(),
        })
        .eq("team_name", standing.team_name);

      if (standingError) {
        console.error(`Error updating ${standing.team_name}:`, standingError);
      }
    }

    // Update team leaders in database
    for (const leader of data.leaders) {
      const { error: leaderError } = await supabase
        .from("team_leaders")
        .update({
          player_name: leader.player_name,
          stat_value: leader.stat_value,
          updated_at: new Date().toISOString(),
        })
        .eq("category", leader.category);

      if (leaderError) {
        console.error(`Error updating ${leader.category} leader:`, leaderError);
      }
    }

    console.log("Standings updated successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Standings updated", data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating standings:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
