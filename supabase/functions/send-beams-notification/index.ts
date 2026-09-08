import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  path: z.string().max(300).optional(),
  icon: z.string().max(500).optional(),
  interests: z.array(z.string().min(1).max(164)).min(1).max(100).optional(),
});

const INSTANCE_ID = Deno.env.get("PUSHER_BEAMS_INSTANCE_ID") ?? "";
const SECRET_KEY = Deno.env.get("PUSHER_BEAMS_SECRET_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!INSTANCE_ID || !SECRET_KEY) {
      return json({ error: "Pusher Beams is not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Admin only
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) return json({ error: "Admin access required" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const { title, body, path, icon, interests } = parsed.data;

    const res = await fetch(
      `https://${INSTANCE_ID}.pushnotifications.pusher.com/publish_api/v1/instances/${INSTANCE_ID}/publishes/interests`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interests: interests ?? ["all-users"],
          web: {
            notification: {
              title,
              body,
              icon: icon ?? "/logo-192.png",
              deep_link: path ? new URL(path, "https://metsxmfanzone.com").toString() : undefined,
            },
          },
          fcm: {
            notification: { title, body },
            data: { path: path ?? "/" },
          },
          apns: {
            aps: { alert: { title, body } },
            data: { path: path ?? "/" },
          },
        }),
      }
    );

    const text = await res.text();
    if (!res.ok) {
      console.error(`Beams publish failed [${res.status}]: ${text}`);
      return json({ error: "Publish failed", status: res.status, details: text }, res.status);
    }

    return json({ sent: true, response: text });
  } catch (err) {
    console.error("send-beams-notification error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
