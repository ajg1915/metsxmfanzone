import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ServiceClient = ReturnType<typeof createClient>;

export type AccountCleanupResult = {
  paypalConfirmed: boolean;
  accountDeleted: boolean;
  cancelledPaypalCount: number;
  failedPaypalCount: number;
  message?: string;
};

export type MembershipCancellationResult = {
  paypalConfirmed: boolean;
  accountRetained: boolean;
  cancellationCount: number;
  limitedAccess: boolean;
  cancelledPaypalCount: number;
  failedPaypalCount: number;
  message?: string;
};

async function getPayPalAccessToken(api: string, id: string, secret: string) {
  const res = await fetch(`${api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error("PayPal authentication failed");
  const data = await res.json();
  return data.access_token as string;
}

async function cancelPayPalSubscription(
  api: string,
  token: string,
  subscriptionId: string,
  reason: string,
): Promise<boolean> {
  const getRes = await fetch(`${api}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  if (getRes.status === 404) return true;

  if (!getRes.ok) {
    console.error("PayPal subscription lookup failed", { status: getRes.status, paypalId: "[REDACTED]" });
    return false;
  }

  const sub = await getRes.json();
  const status = String(sub.status || "").toUpperCase();

  if (["CANCELLED", "EXPIRED"].includes(status)) return true;

  const cancelRes = await fetch(`${api}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });

  if (cancelRes.status === 204 || cancelRes.ok) return true;

  const txt = await cancelRes.text();
  if (cancelRes.status === 422 && /CANCELL?ED|EXPIRED|INVALID_STATUS/i.test(txt)) return true;

  console.error("PayPal subscription cancel failed", { status: cancelRes.status, paypalId: "[REDACTED]" });
  return false;
}

export async function cancelPaypalAndRetainAccount(
  admin: ServiceClient,
  userId: string,
  reason = "Membership cancellation requested",
): Promise<MembershipCancellationResult> {
  const { data: subs, error: subErr } = await admin
    .from("subscriptions")
    .select("id, paypal_subscription_id, status, end_date")
    .eq("user_id", userId);
  if (subErr) throw subErr;

  const paypalIds = Array.from(new Set((subs || []).map((s) => s.paypal_subscription_id).filter(Boolean))) as string[];
  let failedPaypalCount = 0;
  let cancelledPaypalCount = 0;

  if (paypalIds.length > 0) {
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const secret = Deno.env.get("PAYPAL_SECRET");
    const api = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";
    if (!clientId || !secret) throw new Error("PayPal cancellation is not configured");
    const token = await getPayPalAccessToken(api, clientId, secret);
    for (const paypalId of paypalIds) {
      const ok = await cancelPayPalSubscription(api, token, paypalId, reason);
      if (ok) cancelledPaypalCount += 1;
      else failedPaypalCount += 1;
    }
  }

  const { count: priorCount } = await admin
    .from("subscription_activity")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("action", ["membership_cancelled", "account_cancelled_deleted"]);

  if (failedPaypalCount > 0) {
    return {
      paypalConfirmed: false,
      accountRetained: true,
      cancellationCount: priorCount || 0,
      limitedAccess: (priorCount || 0) > 2,
      cancelledPaypalCount,
      failedPaypalCount,
      message: "PayPal did not confirm every cancellation, so your membership was not changed.",
    };
  }

  const nowIso = new Date().toISOString();
  const recentCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: recentCount } = await admin
    .from("subscription_activity")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", "membership_cancelled")
    .gte("created_at", recentCutoff);

  if (subs && subs.length > 0) {
    await admin.from("subscriptions").update({
      status: "cancelled",
      cancellation_status: "cancelled",
      cancellation_requested_at: nowIso,
      updated_at: nowIso,
    }).in("id", subs.map((s) => s.id));

    if (!recentCount) {
      const subscriptionId = subs[0]?.id;
      if (subscriptionId) {
        await admin.from("subscription_activity").insert({
          subscription_id: subscriptionId,
          user_id: userId,
          action: "membership_cancelled",
          details: { reason, paypal_confirmed: true, account_retained: true },
          performed_by: userId,
        });
      }
    }
  }

  const cancellationCount = (priorCount || 0) + (recentCount ? 0 : 1);
  return {
    paypalConfirmed: true,
    accountRetained: true,
    cancellationCount,
    limitedAccess: cancellationCount > 2,
    cancelledPaypalCount,
    failedPaypalCount,
    message: cancellationCount > 2
      ? "PayPal billing was cancelled. Your account remains available with limited access because it has been cancelled more than twice."
      : "PayPal billing was cancelled. Your account remains available and paid access continues until the current billing period ends.",
  };
}

const cleanupTargets = [
  { table: "activity_logs", column: "user_id" },
  { table: "admin_trusted_devices", column: "user_id" },
  { table: "admin_verification_codes", column: "user_id" },
  { table: "ai_image_history", column: "created_by" },
  { table: "blog_views", column: "user_id" },
  { table: "subscription_payments", column: "user_id" },
  { table: "subscription_activity", column: "user_id" },
  { table: "subscription_notifications", column: "user_id" },
  { table: "subscriptions", column: "user_id" },
  { table: "user_roles", column: "user_id" },
  { table: "notification_preferences", column: "user_id" },
  { table: "notification_subscriptions", column: "user_id" },
  { table: "email_confirmation_tokens", column: "user_id" },
  { table: "oauth_csrf_tokens", column: "user_id" },
  { table: "webauthn_challenges", column: "user_id" },
  { table: "chat_usage", column: "user_id" },
  { table: "contact_submissions", column: "user_id" },
  { table: "feedbacks", column: "user_id" },
  { table: "stream_views", column: "user_id" },
  { table: "shop_orders", column: "user_id" },
  { table: "social_media_connections", column: "user_id" },
  { table: "loyalty_rewards", column: "user_id" },
  { table: "review_request_emails", column: "user_id" },
  { table: "post_comments", column: "user_id" },
  { table: "blog_comments", column: "user_id" },
  { table: "story_comments", column: "user_id" },
  { table: "story_likes", column: "user_id" },
  { table: "poll_votes", column: "user_id" },
  { table: "player_of_the_month_votes", column: "user_id" },
  { table: "live_stream_chat", column: "user_id" },
  { table: "gameday_chat", column: "user_id" },
  { table: "gameday_leaderboard", column: "user_id" },
  { table: "gameday_poll_votes", column: "user_id" },
  { table: "gameday_reactions", column: "user_id" },
  { table: "realtime_presence", column: "user_id" },
  { table: "user_passkeys", column: "user_id" },
  { table: "business_ads", column: "user_id" },
  { table: "podcaster_applications", column: "user_id" },
  { table: "writer_applications", column: "user_id" },
  { table: "sweepstakes_winners", column: "user_id" },
  { table: "posts", column: "user_id" },
  { table: "blog_posts", column: "user_id" },
  { table: "blogs", column: "author_id" },
  { table: "game_alerts", column: "created_by" },
  { table: "game_recaps", column: "author_id" },
  { table: "gameday_announcements", column: "created_by" },
  { table: "gameday_polls", column: "created_by" },
  { table: "gameday_voice_rooms", column: "created_by" },
  { table: "player_of_the_month", column: "created_by" },
  { table: "podcast_outline_templates", column: "author_id" },
  { table: "popup_notifications", column: "created_by" },
  { table: "radio_scheduled_shows", column: "created_by" },
  { table: "sweepstakes_events", column: "created_by" },
  { table: "profiles", column: "id" },
];

async function bestEffortUserDataCleanup(admin: ServiceClient, userId: string) {
  for (const target of cleanupTargets) {
    const { error } = await admin.from(target.table).delete().eq(target.column, userId);
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.warn("Account cleanup table step failed", { table: target.table, userId: "[REDACTED]" });
    }
  }
}

export async function cancelPaypalAndDeleteAccount(
  admin: ServiceClient,
  userId: string,
  reason = "Account cancellation requested",
): Promise<AccountCleanupResult> {
  const { data: subs, error: subErr } = await admin
    .from("subscriptions")
    .select("id, paypal_subscription_id, status, end_date")
    .eq("user_id", userId);

  if (subErr) throw subErr;

  const paypalIds = Array.from(
    new Set(
      (subs || [])
        .map((s) => s.paypal_subscription_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let failedPaypalCount = 0;
  let cancelledPaypalCount = 0;

  if (paypalIds.length > 0) {
    const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
    const PAYPAL_SECRET = Deno.env.get("PAYPAL_SECRET");
    const PAYPAL_API = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      throw new Error("PayPal cancellation is not configured");
    }

    const token = await getPayPalAccessToken(PAYPAL_API, PAYPAL_CLIENT_ID, PAYPAL_SECRET);

    for (const paypalId of paypalIds) {
      const ok = await cancelPayPalSubscription(PAYPAL_API, token, paypalId, reason);
      if (ok) cancelledPaypalCount += 1;
      else failedPaypalCount += 1;
    }
  }

  if (failedPaypalCount > 0) {
    return {
      paypalConfirmed: false,
      accountDeleted: false,
      cancelledPaypalCount,
      failedPaypalCount,
      message: "PayPal did not confirm every cancellation, so the account was not deleted.",
    };
  }

  const nowIso = new Date().toISOString();
  if (subs && subs.length > 0) {
    await admin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancellation_status: "cancelled",
        cancellation_requested_at: nowIso,
        end_date: nowIso,
        updated_at: nowIso,
      })
      .in("id", subs.map((s) => s.id));

    for (const s of subs) {
      await admin.from("subscription_activity").insert({
        subscription_id: s.id,
        user_id: userId,
        action: "account_cancelled_deleted",
        details: { reason, paypal_confirmed: true, account_deleted: true },
        performed_by: userId,
      });
    }
  }

  await bestEffortUserDataCleanup(admin, userId);

  let delErrMsg: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (!delErr) {
      delErrMsg = null;
      break;
    }
    delErrMsg = delErr.message;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (delErrMsg) {
    console.error("Auth account deletion failed", { userId: "[REDACTED]" });
    return {
      paypalConfirmed: true,
      accountDeleted: false,
      cancelledPaypalCount,
      failedPaypalCount,
      message: "PayPal billing was cancelled, but the account could not be removed automatically.",
    };
  }

  const [{ count: profileCount }, { count: subCount }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("id", userId),
    admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const accountDeleted = (profileCount || 0) === 0 && (subCount || 0) === 0;
  console.log("Account cancellation cleanup completed", {
    paypalCount: paypalIds.length,
    accountDeleted,
    userId: "[REDACTED]",
  });

  return {
    paypalConfirmed: true,
    accountDeleted,
    cancelledPaypalCount,
    failedPaypalCount,
    message: accountDeleted
      ? "PayPal billing was cancelled and the account was deleted."
      : "PayPal billing was cancelled, but some account records may still need manual review.",
  };
}