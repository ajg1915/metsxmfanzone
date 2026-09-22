import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelPaypalAndDeleteAccount, cancelPaypalAndRetainAccount } from "../_shared/account-cleanup.ts";
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
        .select("id")
        .eq("user_id", action.user_id)
        .eq("status", "active")
        .maybeSingle();

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
      await client.from("subscriptions").update(action.updates).eq("id", action.subscription_id);
      return { message: "Subscription updated" };
    }

    default:
      return { message: `Unknown action: ${action.type}` };
  }
}
