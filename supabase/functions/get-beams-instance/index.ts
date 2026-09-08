const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns the public Pusher Beams instance ID so the browser can register devices.
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  return new Response(
    JSON.stringify({ instanceId: Deno.env.get("PUSHER_BEAMS_INSTANCE_ID") ?? null }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
