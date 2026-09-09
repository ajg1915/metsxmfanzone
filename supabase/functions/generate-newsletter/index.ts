import { createClient } from "npm:@supabase/supabase-js@2";
import { generateCloudflareText } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Admin access required");
    }

    const { topic, tone, sections, audience } = await req.json();

    if (!topic) {
      throw new Error("Topic is required");
    }

    const systemPrompt = `You are an expert newsletter writer. Create engaging, well-structured email newsletters that capture attention and provide value.`;

    const userPrompt = `Create a newsletter with the following parameters:

Topic: ${topic}
Tone: ${tone || "professional and friendly"}
Target Audience: ${audience || "general"}
Sections to include: ${sections || "introduction, main content, call-to-action"}

Generate a complete newsletter with:
1. A compelling subject line
2. An engaging opening
3. Well-organized sections with clear headings
4. Relevant content for each section
5. A strong call-to-action
6. A professional closing

IMPORTANT FORMATTING RULES:
- Use <br> tags for line breaks within paragraphs
- Use <br><br> for paragraph spacing
- Use <h2> and <h3> for section headings
- Use <strong> for emphasis
- Keep the content clean and readable with proper spacing using <br> tags
- Do NOT include <html>, <head>, <body> tags - just the inner content

Format the newsletter content in HTML for email clients.`;

    const generatedContent = await generateCloudflareText({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
    });

    return new Response(
      JSON.stringify({ content: generatedContent }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-newsletter function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
