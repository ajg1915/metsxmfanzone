// Retired in Nov 2026: articles moved to Cloudflare (articles-api Worker, D1 "metsxm-articles").
// Scheduled articles are now published by that Worker's own cron every 5 minutes, and the
// mxf-scheduler Worker sends the "New Article" push when one goes live.
// This function is kept so old callers get a clear answer instead of an error.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ ok: true, published: 0, message: "Scheduled publishing now runs on Cloudflare (articles-api)." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
