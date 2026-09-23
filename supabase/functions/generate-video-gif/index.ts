import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateCloudflareImage } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GifRequest {
  videoUrl: string;
  videoId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting GIF generation request...");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("User verification failed:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("Admin role check failed:", roleError);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { videoUrl, videoId }: GifRequest = await req.json();

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Video URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Generating GIF preview for video:", videoUrl);

    const prompt = `Create a dynamic, animated-style sports highlight preview image with motion blur effects and action poses. Style it like a cinematic baseball moment with dramatic lighting and movement trails. Include visual elements suggesting motion and energy. High quality, vibrant colors, professional sports photography style with motion effects. Ultra high resolution.`;

    console.log("Calling Cloudflare AI for GIF-style image generation...");

    const { bytes } = await generateCloudflareImage({ prompt });

    const fileName = `videos/gif_preview_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;

    let publicUrl: string;
    try {
      publicUrl = await uploadBytesToR2(fileName, bytes, "image/png");
    } catch (uploadError) {
      console.error("R2 upload error:", uploadError instanceof Error ? uploadError.message : uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload preview image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Preview image uploaded:", publicUrl);

    if (videoId) {
      const { error: updateError } = await supabase
        .from("videos")
        .update({ thumbnail_gif_url: publicUrl })
        .eq("id", videoId);

      if (updateError) {
        console.error("Failed to update video record:", updateError);
      } else {
        console.log("Video record updated with GIF URL");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        gifUrl: publicUrl,
        message: "Preview image generated successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating GIF preview:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
