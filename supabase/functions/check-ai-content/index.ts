import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, title } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!content || content.length < 50) {
      return new Response(
        JSON.stringify({ error: "Content too short to analyze (need at least 50 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking article: ${title}`);

    const systemPrompt = `You are a professional editorial content reviewer for MetsXMFanZone, a Mets fan media company under Orange & Blue Media. Your job is to review articles for:

1. ORIGINALITY - Is the writing authentic and original? Does it sound like it was written by a real Mets fan with their own voice, not copied from ESPN, MLB.com, SNY, or other outlets?
2. PLAGIARISM - Does the content appear to copy phrases, paragraphs, or structures from well-known sports media? Flag any sentences that sound like they were lifted from another source.
3. GRAMMAR & SPELLING - Check for typos, grammar mistakes, awkward phrasing, and readability issues.
4. BRAND VOICE - Does the article fit MetsXMFanZone / Orange & Blue Media's tone? It should feel passionate, fan-driven, and authentic — not robotic or generic.

You MUST respond with a JSON object using this exact format:
{
  "originalityScore": number (0-100, where 100 is completely original),
  "isPlagiarized": boolean,
  "plagiarismFlags": ["specific sentences or phrases that seem copied"],
  "grammarIssues": [{"text": "the problematic text", "suggestion": "how to fix it", "type": "grammar|spelling|style"}],
  "brandVoiceScore": number (0-100, how well it fits MetsXMFanZone tone),
  "overallScore": number (0-100, combined quality score),
  "summary": "A brief 2-3 sentence summary of the review",
  "strengths": ["what the article does well"],
  "improvements": ["specific suggestions to improve the article"]
}

Be encouraging but honest. This is a fan media platform — we want authentic fan voices, not polished corporate copy. Prioritize originality and passion over perfection.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Review this article titled "${title}":\n\n${content.substring(0, 10000)}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    let result;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      result = {
        originalityScore: 0,
        isPlagiarized: false,
        plagiarismFlags: [],
        grammarIssues: [],
        brandVoiceScore: 0,
        overallScore: 0,
        summary: "Unable to analyze content at this time. Please try again.",
        strengths: [],
        improvements: [],
      };
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-ai-content:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to check content" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
