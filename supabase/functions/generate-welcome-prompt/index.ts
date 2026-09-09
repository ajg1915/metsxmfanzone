import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateCloudflareText } from "../_shared/cloudflareAi.ts";

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

    const message = await generateCloudflareText({
      messages: [
        {
          role: "system",
          content: `You are a sports news alert writer for MetsXMFanZone, a New York Mets fan community. Write short, punchy, exciting news alerts (max 15 words) that make fans want to click. Use baseball terminology and Mets references. Be enthusiastic but not cheesy. Never use hashtags. Always write MetsXMFanZone as one word.`
        },
        { role: "user", content: context }
      ],
      max_tokens: 50,
      temperature: 0.8,
    });

    return new Response(JSON.stringify({ message: message.trim() || null }), {
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
