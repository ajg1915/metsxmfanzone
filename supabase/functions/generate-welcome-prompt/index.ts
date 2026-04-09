import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newContent } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { blogPosts, liveStreams } = newContent;
    
    // Build context for AI
    let context = "Generate a short, exciting news alert message for a returning MetsXMFanZone visitor. ";
    
    if (liveStreams?.length > 0) {
      const liveNow = liveStreams.filter((s: any) => s.status === 'live');
      if (liveNow.length > 0) {
        context += `There is a LIVE stream happening now: "${liveNow[0].title}". `;
      } else {
        context += `There are ${liveStreams.length} upcoming stream(s). `;
      }
    }
    
    if (blogPosts?.length > 0) {
      context += `There are ${blogPosts.length} new article(s): "${blogPosts[0].title}"${blogPosts.length > 1 ? ' and more' : ''}. `;
    }

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
            content: `You are a sports news alert writer for MetsXMFanZone, a New York Mets fan community. Write short, punchy, exciting news alerts (max 15 words) that make fans want to click. Use baseball terminology and Mets references. Be enthusiastic but not cheesy. Never use hashtags. Always write MetsXMFanZone as one word.`
          },
          {
            role: "user",
            content: context
          }
        ],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited", fallback: true }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required", fallback: true }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim() || null;

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating welcome prompt:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage, fallback: true }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
