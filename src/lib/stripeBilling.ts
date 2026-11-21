// Stripe card checkout (second option next to PayPal). Served by the stripe-billing Worker
// (cloudflare/stripe-billing-worker.js). The card button only shows when the Vercel env var
// VITE_STRIPE_PUBLISHABLE_KEY is set (pk_test_... while testing, pk_live_... once Stripe approves).
import { supabase } from "@/integrations/supabase/client";

export const STRIPE_BILLING_API =
  (import.meta.env.VITE_STRIPE_BILLING_URL as string | undefined) || "https://stripe-billing.metsxmfan.workers.dev";
export const STRIPE_PUBLISHABLE_KEY = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) || "";
export const stripeCardEnabled = STRIPE_PUBLISHABLE_KEY.startsWith("pk_");

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export class StripeBillingError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** Starts a Stripe card checkout for a plan and returns the client secret for Stripe's card screen. */
export async function createCardCheckout(plan: string): Promise<{ clientSecret: string; sessionId: string }> {
  const r = await fetch(`${STRIPE_BILLING_API}/checkout`, { method: "POST", headers: await authHeaders(), body: JSON.stringify({ plan }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.clientSecret) throw new StripeBillingError(data.message || data.error || "Card checkout is unavailable right now.", data.error);
  return data;
}

/** After the card screen finishes: has the webhook turned the membership on yet? */
export async function cardCheckoutStatus(sessionId: string): Promise<{ status: string; active: boolean }> {
  const r = await fetch(`${STRIPE_BILLING_API}/session?id=${encodeURIComponent(sessionId)}`, { headers: await authHeaders() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new StripeBillingError(data.error || "Could not check your payment.");
  return data;
}

/** Opens Stripe's "Manage billing" page for members who pay by card. */
export async function openBillingPortal(returnUrl = window.location.href): Promise<void> {
  const r = await fetch(`${STRIPE_BILLING_API}/portal`, { method: "POST", headers: await authHeaders(), body: JSON.stringify({ returnUrl }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.url) throw new StripeBillingError(data.error || "Billing page is unavailable right now.");
  window.location.href = data.url;
}
