import { createClient } from "npm:@supabase/supabase-js@2";
import { generateCloudflareText } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { title, category, excerpt } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = new Date().toISOString();
    const randomSeed = Math.random().toString(36).substring(7);
    console.log('Generating blog content for:', title, 'at:', timestamp);

    const systemPrompt = `You are an expert New York Mets baseball journalist and analyst with decades of experience covering the team.

CRITICAL REQUIREMENTS:
1. ORIGINALITY: Every article must be 100% original. Never copy or closely paraphrase existing content. Create fresh perspectives and unique angles.
2. AUTHENTICITY: Write with genuine expertise and passion for the Mets. Use your own voice and style.
3. ACCURACY: Only include verifiable facts, statistics, and information. If discussing current events, be clear about what is known vs speculation.
4. UNIQUENESS: Each article must be distinctly different. Vary your writing style, structure, opening hooks, and narrative approaches.
5. NO PLAGIARISM: Generate completely new content from scratch. Do not reproduce phrases or structures from existing articles.

WRITING STYLE:
- Conversational yet professional tone
- Engaging storytelling with vivid descriptions
- Include specific details, stats, and context when relevant
- Use varied sentence structures and paragraph lengths
- Create compelling hooks and memorable conclusions

FORMATTING RULES:
- NO markdown headers (no # symbols)
- NO markdown formatting (no ** or __ or other markup)
- Plain text paragraphs only
- Separate sections with blank lines
- Natural, flowing prose

Generation ID: ${randomSeed}-${Date.now()}`;

    const userPrompt = `Write a fresh, original blog article about: "${title}"
${category ? `Category: ${category}` : ''}
${excerpt ? `Context: ${excerpt}` : ''}

Requirements for this unique article:
1. Create an entirely NEW perspective on this topic - approach it differently than typical coverage
2. Write 500-800 words of 100% ORIGINAL content
3. Include an attention-grabbing opening that hooks readers immediately
4. Develop 3-4 substantive body paragraphs with unique insights
5. End with a memorable, thought-provoking conclusion
6. Ensure all facts and statistics mentioned are accurate
7. Use plain text only - no markdown formatting whatsoever
8. Make this article distinctly different from any other article on this topic

Timestamp: ${timestamp}
Article Variation Seed: ${randomSeed}`;

    const content = await generateCloudflareText({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
    });

    if (!content) {
      throw new Error('No content generated');
    }

    console.log('Successfully generated blog content');

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-blog-content function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
