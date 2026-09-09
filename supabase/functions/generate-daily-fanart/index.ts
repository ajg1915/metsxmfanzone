import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateCloudflareText,
  generateCloudflareImage,
} from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetsNewsItem {
  title: string;
  player: string;
  details: string;
  type: string;
  is_mets_related: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let targetPodcastId: string | null = null;
    try {
      const body = await req.json();
      targetPodcastId = body.podcast_id || null;
    } catch {
      // No body, that's fine
    }

    console.log("Fetching trending Mets news for fan art generation...");

    const metsNewsResponse = await fetch(`${SUPABASE_URL}/functions/v1/fetch-mets-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      }
    });

    let trendingTopics: string[] = [];

    if (metsNewsResponse.ok) {
      const newsData = await metsNewsResponse.json();
      const newsItems: MetsNewsItem[] = newsData.news || [];
      const metsNews = newsItems.filter(item => item.is_mets_related);
      trendingTopics = metsNews.slice(0, 3).map(item => {
        const topic = item.title || item.details || '';
        return topic.substring(0, 100);
      });
      console.log("Trending Mets topics:", trendingTopics);
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: todayShows } = await supabase
      .from('podcast_shows')
      .select('id, title, description')
      .gte('show_date', today)
      .order('show_date', { ascending: true })
      .limit(3);

    console.log("Today's podcast shows:", todayShows?.length || 0);

    let fanArtPrompt = "";

    if (trendingTopics.length > 0) {
      const promptText = await generateCloudflareText({
        messages: [
          {
            role: 'user',
            content: `Based on these trending New York Mets news topics, create a single creative prompt for generating YouTube podcast thumbnail fan art. The art should be exciting, dynamic, and capture the Mets spirit with blue and orange colors.

Trending topics:
${trendingTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return ONLY the image generation prompt, nothing else. Make it vivid and suitable for a sports podcast thumbnail. Include "YouTube thumbnail" and "Mets colors blue and orange" in the prompt.`,
          },
        ],
        max_tokens: 200,
      });

      fanArtPrompt = (promptText || "").trim();
    }

    if (!fanArtPrompt) {
      const defaultPrompts = [
        "YouTube thumbnail featuring the New York Mets logo with dynamic blue and orange energy waves, Citi Field in the background, exciting sports atmosphere, podcast style",
        "Epic Mets baseball action YouTube thumbnail with blue and orange lightning, silhouette of player hitting home run, dramatic sports composition",
        "New York Mets podcast thumbnail featuring baseball diamond with glowing orange and blue effects, Mr. Met character, exciting fan energy",
        "Dynamic Mets podcast fan art with baseball flying through blue and orange flames, Citi Field skyline, YouTube thumbnail style",
        "Exciting New York Mets themed YouTube thumbnail with player celebration, confetti in blue and orange, sports podcast energy"
      ];
      fanArtPrompt = defaultPrompts[Math.floor(Math.random() * defaultPrompts.length)];
    }

    console.log("Generated fan art prompt:", fanArtPrompt);

    const { base64 } = await generateCloudflareImage({ prompt: fanArtPrompt });
    const generatedImageUrl = `data:image/png;base64,${base64}`;

    console.log("Fan art image generated successfully");

    const { error: historyError } = await supabase
      .from('ai_image_history')
      .insert({
        image_url: generatedImageUrl,
        prompt: `[Daily Fan Art] ${fanArtPrompt}`,
        is_edited: false
      });

    if (historyError) {
      console.error("Error saving to history:", historyError);
    }

    let updatedPodcastId: string | null = null;

    if (targetPodcastId) {
      const { error: updateError } = await supabase
        .from('podcast_shows')
        .update({ thumbnail_url: generatedImageUrl })
        .eq('id', targetPodcastId);

      if (!updateError) {
        updatedPodcastId = targetPodcastId;
        console.log("Updated podcast thumbnail:", targetPodcastId);
      }
    } else if (todayShows && todayShows.length > 0) {
      const showWithoutThumb = todayShows.find((s: any) => !s.thumbnail_url);
      if (showWithoutThumb) {
        const { error: updateError } = await supabase
          .from('podcast_shows')
          .update({ thumbnail_url: generatedImageUrl })
          .eq('id', showWithoutThumb.id);

        if (!updateError) {
          updatedPodcastId = showWithoutThumb.id;
          console.log("Auto-attached to podcast:", showWithoutThumb.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: generatedImageUrl,
        prompt: fanArtPrompt,
        trendingTopics,
        updatedPodcastId,
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating daily fan art:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
