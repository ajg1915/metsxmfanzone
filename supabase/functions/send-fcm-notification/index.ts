import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  path: z.string().max(500).optional(),
  userId: z.string().uuid().optional(),
  topic: z.string().min(1).max(100).optional(),
  latestOnly: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const connectionApiKey = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
    if (!LOVABLE_API_KEY || !connectionApiKey) {
      return json({ error: "Firebase Cloud Messaging is not configured" }, 500);
    }

    // --- Auth: admins only ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // --- Input ---
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { title, body, path, userId, topic, latestOnly } = parsed.data;

    const headers = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": connectionApiKey,
      "Content-Type": "application/json",
    };

    const notification = { title, body };
    const data = path ? { path } : undefined;

    const send = async (message: Record<string, unknown>) => {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    };

    // Topic broadcast
    if (topic) {
      const result = await send({ topic, notification, data });
      if (!result.ok) {
        console.error(`FCM topic send failed [${result.status}]: ${result.text}`);
        return json({ error: "Provider request failed", status: result.status, details: result.text }, result.status);
      }
      return json({ sent: 1, failed: 0, target: "topic" });
    }

    // Token targets
    let query = admin.from("fcm_tokens").select("token").order("created_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    if (latestOnly) query = query.limit(1);
    const { data: rows, error: tokensError } = await query;
    if (tokensError) return json({ error: tokensError.message }, 500);

    const tokens = (rows ?? []).map((r: { token: string }) => r.token);
    if (tokens.length === 0) return json({ sent: 0, failed: 0, message: "No registered devices" });

    let sent = 0;
    const stale: string[] = [];
    const failures: string[] = [];

    for (const token of tokens) {
      const result = await send({ token, notification, data });
      if (result.ok) {
        sent++;
      } else if (result.status === 404 || result.status === 400) {
        stale.push(token);
      } else {
        console.error(`FCM send failed [${result.status}]: ${result.text}`);
        failures.push(`${result.status}: ${result.text}`);
      }
    }

    if (stale.length > 0) {
      await admin.from("fcm_tokens").delete().in("token", stale);
    }

    return json({ sent, failed: failures.length, removed: stale.length, failures: failures.slice(0, 3) });
  } catch (error) {
    console.error("send-fcm-notification error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
