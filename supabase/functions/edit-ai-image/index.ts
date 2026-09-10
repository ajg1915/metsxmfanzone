import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCloudflareAiConfig, buildCloudflareAiUrl } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMG2IMG_MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, prompt } = await req.json();

    if (!imageUrl || typeof imageUrl !== 'string' || !prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Image URL and prompt are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accountId, apiToken } = getCloudflareAiConfig();

    // Load the source image bytes (supports http(s) URLs and data URLs)
    let sourceBytes: Uint8Array;
    if (imageUrl.startsWith('data:')) {
      const base64Part = imageUrl.split(',')[1] ?? '';
      const binary = atob(base64Part);
      sourceBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) sourceBytes[i] = binary.charCodeAt(i);
    } else {
      const srcRes = await fetch(imageUrl);
      if (!srcRes.ok) throw new Error(`Unable to load source image (${srcRes.status})`);
      sourceBytes = new Uint8Array(await srcRes.arrayBuffer());
    }

    const cfRes = await fetch(buildCloudflareAiUrl(accountId, IMG2IMG_MODEL), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image: Array.from(sourceBytes),
        strength: 0.6,
      }),
    });

    if (!cfRes.ok) {
      const errText = await cfRes.text().catch(() => '');
      console.error('Cloudflare image edit error:', cfRes.status, errText.slice(0, 300));
      if (cfRes.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Image editing service unavailable. Please try again shortly.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const editedBase64 = toBase64(await cfRes.arrayBuffer());

    return new Response(
      JSON.stringify({ imageUrl: `data:image/png;base64,${editedBase64}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error editing image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
