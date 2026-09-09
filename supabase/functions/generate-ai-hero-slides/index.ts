import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateCloudflareText } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { count = 3 } = await req.json().catch(() => ({ count: 3 }));

    // 1. Gather content from all sources
    const [blogRes, streamsRes, podcastRes, newsRes] = await Promise.all([
      supabase.from("blog_posts").select("id, title, excerpt, slug, featured_image_url, category").eq("published", true).order("published_at", { ascending: false }).limit(5),
      supabase.from("live_streams").select("id, title, description, status, thumbnail_url").eq("published", true).order("created_at", { ascending: false }).limit(5),
      supabase.from("podcast_shows").select("id, title, description, show_date, thumbnail_url").eq("published", true).order("show_date", { ascending: false }).limit(5),
      supabase.from("mets_news_tracker").select("id, title, details, player, type, image_url").eq("published", true).order("created_at", { ascending: false }).limit(5),
    ]);

    const contentSummary = {
      blogs: (blogRes.data || []).map(b => `"${b.title}" - ${b.excerpt || b.category}`).join("\n"),
      streams: (streamsRes.data || []).map(s => `"${s.title}" (${s.status}) - ${s.description || ""}`).join("\n"),
      podcasts: (podcastRes.data || []).map(p => `"${p.title}" - ${p.description || ""}`).join("\n"),
      news: (newsRes.data || []).map(n => `"${n.title}" about ${n.player} - ${n.details}`).join("\n"),
    };

    // 2. Fetch available images from media library
    const { data: mediaFiles } = await supabase
      .from("media_library")
      .select("file_url, file_name, file_type")
      .or("file_type.ilike.%image%,file_name.ilike.%.jpg,file_name.ilike.%.png,file_name.ilike.%.jpeg,file_name.ilike.%.webp")
      .order("created_at", { ascending: false })
      .limit(50);

    const availableImages = (mediaFiles || []).map(f => f.file_url).filter(Boolean);
    console.log(`Found ${availableImages.length} images in media library`);

    // 3. Generate slide content via Cloudflare AI
    const slidePrompt = `Based on this current MetsXMFanZone content, generate exactly ${count} hero slides as a JSON object with a "slides" array. Each slide needs: title (max 6 words, bold/uppercase style), description (max 25 words, compelling), link_url (relevant page on the site), link_text (CTA text, max 3 words), show_watch_live (boolean, true if streaming related), is_for_members (boolean, false for conversion slides targeting non-members), image_index (integer, pick the best matching image index from the available media library images listed below).

Available media library images (pick by index):
${availableImages.map((url, i) => `${i}: ${url}`).join("\n") || "No images available"}

Available content:
BLOG POSTS:
${contentSummary.blogs || "No recent blogs"}

LIVE STREAMS:
${contentSummary.streams || "No active streams"}

PODCASTS:
${contentSummary.podcasts || "No recent podcasts"}

NEWS:
${contentSummary.news || "No recent news"}

Valid link_url values: /auth (signup), /pricing (plans), /metsxmfanzone (streams), /podcast (podcasts), /blog (blog), /community (community), /mets-roster (roster)

Return ONLY a valid JSON object with a "slides" array, no markdown, no explanation.`;

    const aiText = await generateCloudflareText({
      messages: [
        {
          role: "system",
          content: `You are MetsXMFanZone.com's marketing AI. Generate hero slide content designed to convert visitors into members. The brand is a Mets fan community platform with live streaming, podcasts, news, and community features. Pricing: Free Spring Training access, then $9.99/mo for premium. Tone: passionate, energetic, authentic NY Mets fan voice. Always use action-oriented CTAs. ALWAYS respond with ONLY valid JSON. No markdown, no explanation.`
        },
        { role: "user", content: slidePrompt },
      ],
      max_tokens: 2048,
    });

    const cleaned = aiText.replace(/^```json\s*|\s*```$/g, "").trim();
    let slides: any[];
    try {
      const parsed = JSON.parse(cleaned);
      slides = parsed.slides;
    } catch (parseErr) {
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        const parsed = JSON.parse(objectMatch[0]);
        slides = parsed.slides;
      } else {
        throw parseErr;
      }
    }
    if (!slides?.length) throw new Error("No slides generated");

    console.log(`Generated ${slides.length} slide concepts`);

    // 4. Insert slides using media library images
    const generatedSlides = [];
    for (const slide of slides) {
      // Pick image from media library by index, fallback to random or null
      let imageUrl: string | null = null;
      if (availableImages.length > 0) {
        const idx = typeof slide.image_index === "number" && slide.image_index >= 0 && slide.image_index < availableImages.length
          ? slide.image_index
          : Math.floor(Math.random() * availableImages.length);
        imageUrl = availableImages[idx];
      }

      // Get max display_order
      const { data: maxOrder } = await supabase
        .from("hero_slides")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1);
      const nextOrder = ((maxOrder?.[0]?.display_order) || 0) + 1;

      const { data: inserted, error: insertError } = await supabase
        .from("hero_slides")
        .insert({
          title: slide.title,
          description: slide.description,
          image_url: imageUrl,
          link_url: slide.link_url,
          link_text: slide.link_text,
          show_watch_live: slide.show_watch_live,
          is_for_members: slide.is_for_members,
          published: true,
          display_order: nextOrder,
          is_ai_generated: true,
          ai_source_type: "media_library",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        generatedSlides.push(inserted);
        console.log(`Slide inserted: "${slide.title}" with media image`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      slides_generated: generatedSlides.length,
      slides: generatedSlides 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
