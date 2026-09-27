import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelPaypalAndDeleteAccount, cancelPaypalAndRetainAccount, stopPaypalBillingForRow } from "../_shared/account-cleanup.ts";
import { generateCloudflareText } from "../_shared/cloudflareAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { command, action } = await req.json();

    // If action is provided, execute it directly (AI-determined action)
    if (action) {
      const result = await executeAction(adminClient, action, caller.id);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise, process natural language command via AI
    if (!command) {
      return new Response(JSON.stringify({ error: "Command or action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current state for AI context
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, email, full_name, created_at")
      .order("created_at", { ascending: false });

    const { data: subscriptions } = await adminClient
      .from("subscriptions")
      .select("id, user_id, plan_type, status, amount, payment_method, start_date, end_date, cancellation_status, notes")
      .order("created_at", { ascending: false });

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("id, user_id, role");

    // Build context
    const memberContext = (profiles || []).map(p => {
      const userSubs = (subscriptions || []).filter(s => s.user_id === p.id);
      const activeSub = userSubs.find(s => s.status === "active") || userSubs[0];
      const userRoles = (roles || []).filter(r => r.user_id === p.id).map(r => r.role);
      return {
        user_id: p.id,
        email: p.email,
        full_name: p.full_name,
        subscription: activeSub ? {
          id: activeSub.id,
          plan: activeSub.plan_type,
          status: activeSub.status,
          payment_method: activeSub.payment_method,
          end_date: activeSub.end_date,
          cancellation_status: activeSub.cancellation_status,
        } : null,
        roles: userRoles,
        joined: p.created_at,
      };
    });

    const systemPrompt = `You are the AI administrator for the MetsXMFanZone platform. You manage user accounts, subscriptions, and roles.

CURRENT MEMBERS DATA:
${JSON.stringify(memberContext, null, 2)}

RULES YOU MUST FOLLOW:
1. Writers always get a FREE 1-year annual membership marked as "active" with payment_method "writer_comp"
2. When activating a subscription, set status to "active" and calculate proper end_date (premium = 1 month, annual = 1 year from now)
3. When cancelling or deleting a member account, cancel every linked PayPal agreement first, then delete the account
4. Never delete the admin's own account (admin caller id: ${caller.id})
5. Payment methods can be: helcim, paypal, square, cash, check, zelle, venmo, writer_comp, free, online
6. Plan types: free, premium, annual
7. Roles: admin, writer, moderator, user
8. When asked to "clean up" or "remove" pending/inactive accounts, delete their subscription records but keep user profiles unless explicitly told to delete accounts
9. For bulk operations, list what you'll do and execute

AVAILABLE ACTIONS (return as JSON array):
- { "type": "activate_subscription", "user_id": "...", "plan_type": "...", "payment_method": "...", "end_date": "ISO date" }
- { "type": "cancel_subscription", "user_id": "...", "subscription_id": "..." }
- { "type": "extend_subscription", "user_id": "...", "subscription_id": "...", "days": number }
- { "type": "create_subscription", "user_id": "...", "plan_type": "...", "status": "active", "payment_method": "...", "amount": number, "end_date": "ISO date" }
- { "type": "delete_subscription", "subscription_id": "..." }
- { "type": "add_role", "user_id": "...", "role": "..." }
- { "type": "remove_role", "role_id": "..." }
- { "type": "delete_account", "user_id": "..." }
- { "type": "update_subscription", "subscription_id": "...", "updates": { ... } }

Respond with a JSON object: { "message": "Human-readable summary of what you did/will do", "actions": [...array of actions to execute...] }
If the command is a question or info request, return { "message": "your answer", "actions": [] }
IMPORTANT: Always return valid JSON. No markdown, no code blocks.`;

    const content = await generateCloudflareText({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: command },
      ],
    });
    
    // Parse AI response - handle potential markdown code blocks
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ message: content, actions: [], executed: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute actions
    const executed: string[] = [];
    for (const act of (parsed.actions || [])) {
      try {
        const result = await executeAction(adminClient, act, caller.id);
        executed.push(result.message || `Executed ${act.type}`);
      } catch (e) {
        executed.push(`Failed: ${act.type} - ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({
      message: parsed.message,
      actions: parsed.actions || [],
      executed,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function executeAction(client: any, action: any, adminId: string) {
  switch (action.type) {
    case "paypal_billing_report": {
      return await buildPayPalBillingReport(client);
    }

    case "activate_subscription": {
      const endDate = action.end_date || (() => {
        const d = new Date();
        if (action.plan_type === "annual") d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return d.toISOString();
      })();

      // Check for existing active sub
      const { data: existing } = await client
        .from("subscriptions")
        .select("id, plan_type, paypal_subscription_id")
        .eq("user_id", action.user_id)
        .eq("status", "active")
        .neq("plan_type", "ny_sports")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.paypal_subscription_id && existing.plan_type !== (action.plan_type || "premium")) {
        await stopPaypalBillingForRow(client, existing.id, "Admin AI changed plan");
      }

      if (existing) {
        await client.from("subscriptions").update({
          plan_type: action.plan_type || "premium",
          status: "active",
          payment_method: action.payment_method || "online",
          end_date: endDate,
          start_date: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        // Update any pending or create new
        const { data: pendingSub } = await client
          .from("subscriptions")
          .select("id")
          .eq("user_id", action.user_id)
          .neq("status", "active")
          .maybeSingle();

        if (pendingSub) {
          await client.from("subscriptions").update({
            plan_type: action.plan_type || "premium",
            status: "active",
            payment_method: action.payment_method || "online",
            end_date: endDate,
            start_date: new Date().toISOString(),
          }).eq("id", pendingSub.id);
        } else {
          await client.from("subscriptions").insert({
            user_id: action.user_id,
            plan_type: action.plan_type || "premium",
            status: "active",
            payment_method: action.payment_method || "online",
            amount: action.amount || 0,
            start_date: new Date().toISOString(),
            end_date: endDate,
          });
        }
      }

      await client.from("subscription_activity").insert({
        subscription_id: existing?.id || "new",
        user_id: action.user_id,
        action: "ai_activated",
        details: { plan_type: action.plan_type, method: action.payment_method },
        performed_by: adminId,
      }).catch(() => {});

      return { message: `Subscription activated for user` };
    }

    case "cancel_subscription": {
      if (action.subscription_id) {
        const { data: sub } = await client
          .from("subscriptions")
          .select("user_id")
          .eq("id", action.subscription_id)
          .maybeSingle();
        const result = await cancelPaypalAndRetainAccount(
          client,
          sub?.user_id || action.user_id,
          "Admin AI cancelled subscription",
          sub ? { subscriptionIds: [action.subscription_id] } : {},
        );
        if (!result.paypalConfirmed) {
          throw new Error(result.message || "Cancellation failed");
        }
      } else {
        const result = await cancelPaypalAndRetainAccount(
          client,
          action.user_id,
          "Admin AI cancelled subscription",
        );
        if (!result.paypalConfirmed) {
          throw new Error(result.message || "Cancellation failed");
        }
      }
      return { message: "PayPal billing cancelled and member account retained" };
    }

    case "extend_subscription": {
      const { data: sub } = await client
        .from("subscriptions")
        .select("end_date")
        .eq("id", action.subscription_id)
        .single();

      const currentEnd = sub?.end_date ? new Date(sub.end_date) : new Date();
      currentEnd.setDate(currentEnd.getDate() + (action.days || 30));

      await client.from("subscriptions").update({
        end_date: currentEnd.toISOString(),
        status: "active",
      }).eq("id", action.subscription_id);

      return { message: `Extended by ${action.days || 30} days` };
    }

    case "create_subscription": {
      await client.from("subscriptions").insert({
        user_id: action.user_id,
        plan_type: action.plan_type || "free",
        status: action.status || "active",
        payment_method: action.payment_method || "free",
        amount: action.amount || 0,
        start_date: new Date().toISOString(),
        end_date: action.end_date || null,
      });
      return { message: "Subscription created" };
    }

    case "delete_subscription": {
      await stopPaypalBillingForRow(client, action.subscription_id, "Admin AI deleted subscription");
      await client.from("subscriptions").delete().eq("id", action.subscription_id);
      return { message: "Subscription deleted" };
    }

    case "add_role": {
      await client.from("user_roles").insert({
        user_id: action.user_id,
        role: action.role,
      });

      // Writer auto-membership
      if (action.role === "writer") {
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        const { data: existingSub } = await client
          .from("subscriptions")
          .select("id")
          .eq("user_id", action.user_id)
          .eq("status", "active")
          .maybeSingle();

        if (!existingSub) {
          await client.from("subscriptions").insert({
            user_id: action.user_id,
            plan_type: "annual",
            status: "active",
            amount: 0,
            payment_method: "writer_comp",
            start_date: new Date().toISOString(),
            end_date: endDate.toISOString(),
            notes: "Complimentary 1-year membership for writer role",
          });
        }
      }
      return { message: `Role ${action.role} added` };
    }

    case "remove_role": {
      await client.from("user_roles").delete().eq("id", action.role_id);
      return { message: "Role removed" };
    }

    case "delete_account": {
      const result = await cancelPaypalAndDeleteAccount(client, action.user_id, "Admin AI deleted account");
      if (!result.paypalConfirmed || !result.accountDeleted) {
        throw new Error(result.message || "Account cleanup failed");
      }
      return { message: "PayPal billing cancelled and account deleted" };
    }

    case "update_subscription": {
      const u = action.updates || {};
      // Changing the plan or ending the membership must stop PayPal billing first.
      if ("plan_type" in u || ("status" in u && u.status !== "active")) {
        await stopPaypalBillingForRow(client, action.subscription_id, "Admin AI changed subscription");
      }
      await client.from("subscriptions").update(u).eq("id", action.subscription_id);
      return { message: "Subscription updated" };
    }

    default:
      return { message: `Unknown action: ${action.type}` };
  }
}

// ---------------------------------------------------------------------------
// Read-only PayPal billing report for the admin portal. Asks PayPal directly
// what every subscription is doing and compares it with the site's records.
// Never changes billing or data.
// ---------------------------------------------------------------------------
async function buildPayPalBillingReport(client: any) {
  const api = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";
  const tokenRes = await fetch(`${api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_SECRET")}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) throw new Error("Could not sign in to PayPal");
  const token = (await tokenRes.json()).access_token;
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data: rows } = await client
    .from("subscriptions")
    .select("id, user_id, plan_type, status, end_date, paypal_subscription_id, paypal_order_id, created_at")
    .order("created_at", { ascending: false });
  const { data: profiles } = await client.from("profiles").select("id, email, full_name");
  const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
  const profileByEmail = new Map((profiles || []).filter((p: any) => p.email).map((p: any) => [String(p.email).toLowerCase(), p]));

  const dbById = new Map<string, any>();
  for (const r of rows || []) {
    for (const v of [r.paypal_subscription_id, r.paypal_order_id]) {
      if (v && String(v).startsWith("I-") && !dbById.has(v)) dbById.set(v, r);
    }
  }

  // PayPal subscriptions that charged in the last 31 days (finds ones the site never recorded).
  const charged = new Set<string>();
  let transactionsAvailable = true;
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 31 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
    const tx = await fetch(
      `${api}/v1/reporting/transactions?start_date=${fmt(start)}&end_date=${fmt(end)}&page_size=500&fields=transaction_info`,
      { headers: H },
    );
    if (!tx.ok) throw new Error(String(tx.status));
    const txData = await tx.json();
    for (const t of txData.transaction_details || []) {
      const info = t.transaction_info || {};
      if (info.paypal_reference_id_type === "RP" && String(info.paypal_reference_id || "").startsWith("I-")) {
        charged.add(info.paypal_reference_id);
      }
    }
  } catch (_) {
    transactionsAvailable = false;
  }

  const ids = new Set<string>([...dbById.keys(), ...charged]);
  const planNames = new Map<string, string | null>();
  const items: any[] = [];

  for (const pid of ids) {
    const res = await fetch(`${api}/v1/billing/subscriptions/${pid}`, { headers: H });
    const s = res.ok ? await res.json() : null;
    let planName: string | null = null;
    if (s?.plan_id) {
      if (!planNames.has(s.plan_id)) {
        const p = await fetch(`${api}/v1/billing/plans/${s.plan_id}`, { headers: H });
        planNames.set(s.plan_id, p.ok ? (await p.json()).name ?? null : null);
      }
      planName = planNames.get(s.plan_id) ?? null;
    }
    const db = dbById.get(pid) || null;
    const subscriberEmail = s?.subscriber?.email_address ? String(s.subscriber.email_address).toLowerCase() : null;
    const member = db ? profileById.get(db.user_id) : (subscriberEmail ? profileByEmail.get(subscriberEmail) : null);
    const paypalStatus = res.status === 404 ? "NOT_FOUND" : String(s?.status || "UNKNOWN").toUpperCase();
    const siteActive = !!db && (db.status === "active" || (db.status === "cancelled" && db.end_date && new Date(db.end_date) > new Date()));

    let issue: string | null = null;
    if (!db && paypalStatus === "ACTIVE") issue = "not_on_site";
    else if (db && paypalStatus === "ACTIVE" && !siteActive) issue = "charging_but_site_ended";
    else if (db && db.status === "active" && ["CANCELLED", "EXPIRED", "SUSPENDED", "NOT_FOUND"].includes(paypalStatus)) issue = "site_active_but_paypal_stopped";

    items.push({
      paypal_id: pid,
      paypal_status: paypalStatus,
      plan_name: planName,
      price: s?.billing_info?.last_payment?.amount?.value ?? s?.plan?.billing_cycles?.[0]?.pricing_scheme?.fixed_price?.value ?? null,
      last_payment: s?.billing_info?.last_payment?.time ?? null,
      next_billing: s?.billing_info?.next_billing_time ?? null,
      failed_payments: s?.billing_info?.failed_payments_count ?? 0,
      member_id: db?.user_id ?? member?.id ?? null,
      member_name: member?.full_name ?? (s?.subscriber?.name ? `${s.subscriber.name.given_name ?? ""} ${s.subscriber.name.surname ?? ""}`.trim() : null),
      member_email: member?.email ?? subscriberEmail,
      site_plan: db?.plan_type ?? null,
      site_status: db?.status ?? null,
      site_end_date: db?.end_date ?? null,
      on_site: !!db,
      charged_last_31_days: charged.has(pid),
      issue,
    });
  }

  // Members billed more than once for the same kind of plan.
  const activeByMember = new Map<string, any[]>();
  for (const it of items) {
    if (it.paypal_status !== "ACTIVE" || !it.member_id) continue;
    const group = /ny sports/i.test(it.plan_name || "") || it.site_plan === "ny_sports" ? "ny" : "mets";
    const key = `${it.member_id}:${group}`;
    activeByMember.set(key, [...(activeByMember.get(key) || []), it]);
  }
  for (const list of activeByMember.values()) {
    if (list.length > 1) for (const it of list) it.issue = it.issue || "billed_twice", it.billed_twice = true;
  }

  const order: Record<string, number> = { billed_twice: 0, not_on_site: 1, charging_but_site_ended: 2, site_active_but_paypal_stopped: 3 };
  items.sort((a, b) =>
    (a.issue ? order[a.issue] ?? 9 : 10) - (b.issue ? order[b.issue] ?? 9 : 10) ||
    Number(b.paypal_status === "ACTIVE") - Number(a.paypal_status === "ACTIVE"),
  );

  return {
    message: "PayPal billing report ready",
    generated_at: new Date().toISOString(),
    transactions_available: transactionsAvailable,
    summary: {
      active_on_paypal: items.filter((i) => i.paypal_status === "ACTIVE").length,
      billed_twice: new Set(items.filter((i) => i.billed_twice).map((i) => i.member_id)).size,
      not_on_site: items.filter((i) => i.issue === "not_on_site").length,
      charging_but_site_ended: items.filter((i) => i.issue === "charging_but_site_ended").length,
      site_active_but_paypal_stopped: items.filter((i) => i.issue === "site_active_but_paypal_stopped").length,
    },
    items,
  };
}
