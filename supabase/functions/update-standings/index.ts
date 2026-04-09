import { createClient } from "npm:@supabase/supabase-js@2";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });

    console.log(`Updating standings for ${today}`);

    // Use Lovable AI to get current standings data
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a sports data assistant. Provide realistic MLB NL East division standings and Mets team leaders. 
            Since this is for a 2026 season simulation, generate plausible standings data that changes slightly each day.
            Always respond with the exact JSON format requested.`,
          },
          {
            role: "user",
            content: `Generate current NL East standings and Mets team leaders for ${today}. 
            
            Return ONLY valid JSON in this exact format:
            {
              "standings": [
                {"team_name": "TeamName", "wins": 0, "losses": 0, "games_back": "-", "position": 1}
              ],
              "leaders": [
                {"category": "AVG", "player_name": "Player", "stat_value": ".300"},
                {"category": "HR", "player_name": "Player", "stat_value": "25"},
                {"category": "RBI", "player_name": "Player", "stat_value": "60"}
              ]
            }
            
            Include all 5 NL East teams: Mets, Braves, Phillies, Marlins, Nationals.
            Make the stats realistic for mid-season (around 77 games played).
            The Mets should be competitive but standings can vary.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "update_standings",
              description: "Update MLB standings and team leaders",
              parameters: {
                type: "object",
                properties: {
                  standings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        team_name: { type: "string" },
                        wins: { type: "number" },
                        losses: { type: "number" },
                        games_back: { type: "string" },
                        position: { type: "number" },
                      },
                      required: ["team_name", "wins", "losses", "games_back", "position"],
                    },
                  },
                  leaders: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        player_name: { type: "string" },
                        stat_value: { type: "string" },
                      },
                      required: ["category", "player_name", "stat_value"],
                    },
                  },
                },
                required: ["standings", "leaders"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "update_standings" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI response received");

    // Extract the tool call arguments
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call response from AI");
    }

    const data = JSON.parse(toolCall.function.arguments);
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
