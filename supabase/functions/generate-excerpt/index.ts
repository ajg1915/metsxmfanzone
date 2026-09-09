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
    const { title, content, category } = await req.json();

    if (!title && !content) {
      return new Response(
        JSON.stringify({ error: "Title or content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = content
      ? `Generate a compelling, engaging excerpt (2-3 sentences, max 150 characters) for this blog article. The excerpt should hook readers and summarize the key points. Do not use quotes around the excerpt.

Title: ${title || "Untitled"}
Category: ${category || "General"}
Content: ${content.substring(0, 1500)}

Return ONLY the excerpt text, nothing else.`
      : `Generate a compelling, engaging excerpt (2-3 sentences, max 150 characters) for a blog article with this title. The excerpt should hook readers and make them want to read more. Do not use quotes around the excerpt.

Title: ${title}
Category: ${category || "General"}

Return ONLY the excerpt text, nothing else.`;

    console.log("Generating excerpt for:", title);

    const excerpt = await generateCloudflareText({
      messages: [
        {
          role: "system",
          content: "You are a professional blog editor for MetsXMFanZone, a New York Mets fan community. Generate concise, engaging excerpts that capture the essence of articles and entice readers to click and read more. Keep excerpts under 150 characters."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    const trimmed = excerpt.trim();
    if (!trimmed) {
      return new Response(
        JSON.stringify({ error: "No excerpt generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generated excerpt:", trimmed);

    return new Response(
      JSON.stringify({ excerpt: trimmed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-excerpt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
