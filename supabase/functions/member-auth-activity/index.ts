import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createServiceClient, queueTransactionalEmail } from "../_shared/queue-email.ts";
import { renderBrandedEmailFor } from "../_shared/email-brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] || char));

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return response({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) return response({ error: "Service unavailable" }, 503);

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return response({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.eventType !== "login") return response({ error: "Invalid event type" }, 400);

    const service = createServiceClient();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await service.from("activity_logs").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("action", "member_login_success").gte("created_at", fiveMinutesAgo);
    if (count) return response({ success: true, deduplicated: true });

    const userAgent = String(req.headers.get("user-agent") || "Unknown device").slice(0, 500);
    await service.from("activity_logs").insert({
      user_id: user.id,
      action: "member_login_success",
      log_type: "auth",
      resource_type: "member_session",
      user_agent: userAgent,
      details: { source: "member_login", email: "[REDACTED]" },
    });

    const [{ data: profile }, { data: adminRoles }] = await Promise.all([
      service.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      service.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const adminIds = (adminRoles || []).map((role) => role.user_id);
    const { data: admins } = adminIds.length
      ? await service.from("profiles").select("email").in("id", adminIds)
      : { data: [] };
    const safeName = escapeHtml(profile?.full_name || "A member");
    const safeAgent = escapeHtml(userAgent);
    const time = escapeHtml(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));

    const adminHtml = await renderBrandedEmailFor(service, {
      preheader: "A member just signed in to MetsXMFanZone.",
      heading: "Member login",
      content: `<p style="margin:0 0 8px;"><strong>${safeName}</strong> signed in at ${time} ET.</p><p style="color:#8b93a1;font-size:12px;margin:0;">${safeAgent}</p>`,
      cta: { label: "View activity", url: "https://metsxmfanzone.com/admin/activity" },
    });

    for (const admin of admins || []) {
      if (!admin.email) continue;
      await queueTransactionalEmail(service, {
        to: admin.email,
        subject: "Member login — MetsXMFanZone",
        label: "admin_member_login",
        idempotencyKey: `admin-member-login:${user.id}:${admin.email.toLowerCase()}:${Math.floor(Date.now() / 300000)}`,
        html: adminHtml,
      });
    }

    if (adminIds.length) {
      await service.functions.invoke("send-push-notification", { body: {
        title: "Member login",
        body: `${profile?.full_name || "A member"} signed in.`,
        url: "/admin/activity",
        icon: "/logo-192.png",
        tag: `member-login-${user.id}`,
        targetUsers: adminIds,
      }});
    }
    return response({ success: true });
  } catch (error) {
    console.error("Member auth activity failed", error instanceof Error ? error.message : "Unknown error");
    return response({ error: "Unable to record login activity" }, 500);
  }
});