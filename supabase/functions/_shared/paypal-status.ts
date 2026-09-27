// Shared helper: ask PayPal what a subscription is really doing before the
// site marks a member expired or cancelled. PayPal is the source of truth for
// billing — our end_date can lag if a renewal webhook is missed.

let cachedToken: { value: string; expires: number } | null = null;

export async function getPayPalToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET");
  if (!id || !secret) return null;
  const api = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";
  const res = await fetch(`${api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = await res.json();
  cachedToken = { value: data.access_token, expires: Date.now() + 5 * 60 * 1000 };
  return data.access_token as string;
}

export type PayPalSubState = {
  /** ACTIVE, SUSPENDED, CANCELLED, EXPIRED, APPROVAL_PENDING, APPROVED, NOT_FOUND, or UNKNOWN (lookup failed) */
  status: string;
  nextBillingTime: string | null;
};

export async function getPayPalSubscriptionState(subscriptionId: string): Promise<PayPalSubState> {
  const token = await getPayPalToken();
  if (!token) return { status: "UNKNOWN", nextBillingTime: null };
  const api = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";
  const res = await fetch(`${api}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 404) return { status: "NOT_FOUND", nextBillingTime: null };
  if (!res.ok) return { status: "UNKNOWN", nextBillingTime: null };
  const sub = await res.json();
  return {
    status: String(sub.status || "UNKNOWN").toUpperCase(),
    nextBillingTime: sub.billing_info?.next_billing_time ?? null,
  };
}

/**
 * For a subscription row whose end_date has passed: if PayPal says it is still
 * ACTIVE (still billing), move end_date to PayPal's next billing time so the
 * member keeps access, and return true so the caller skips expiring them.
 */
export async function syncIfStillBilling(
  supabase: any,
  row: { id: string; paypal_subscription_id?: string | null },
): Promise<boolean> {
  if (!row.paypal_subscription_id) return false;
  const state = await getPayPalSubscriptionState(row.paypal_subscription_id);
  // If PayPal can't be reached, never expire a PayPal-billed member on a guess.
  if (state.status === "UNKNOWN") return true;
  if (state.status !== "ACTIVE") return false;
  const nextEnd = state.nextBillingTime
    ? new Date(new Date(state.nextBillingTime).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;
  await supabase
    .from("subscriptions")
    .update({ status: "active", ...(nextEnd ? { end_date: nextEnd } : {}), updated_at: new Date().toISOString() })
    .eq("id", row.id);
  console.log("Synced still-billing PayPal subscription instead of expiring it", { rowId: "[REDACTED]" });
  return true;
}
