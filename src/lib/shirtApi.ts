import { supabase } from "@/integrations/supabase/client";

// Served by the member-perks Worker (cloudflare/member-perks-worker.js), data kept in R2.
export const PERKS_API = "https://member-perks.metsxmfan.workers.dev";
export const SHIRT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

export interface ShirtStatus { eligible: boolean; claimed: boolean; reason: string }
export interface ShirtClaim {
  id: string; email: string; name: string; size: string;
  address1: string; address2: string; city: string; state: string; zip: string; phone: string;
  shipped: boolean; created_at: string; shipped_at?: string;
}
export type ShirtForm = Omit<ShirtClaim, "id" | "email" | "shipped" | "created_at" | "shipped_at">;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in");
  let res: Response;
  try {
    res = await fetch(`${PERKS_API}${path}`, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch {
    throw new Error("Can't reach the shirt service right now. Please try again in a few minutes.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Shirt service error (${res.status})`);
  return body as T;
}

export const getShirtStatus = () => call<ShirtStatus>("/shirt/me");
export const claimShirt = (form: ShirtForm) => call<{ ok: boolean; emailed: boolean }>("/shirt/claim", { method: "POST", body: JSON.stringify(form) });
export const listShirtClaims = () => call<{ claims: ShirtClaim[] }>("/shirt/claims");
export const setShirtShipped = (id: string, shipped: boolean) =>
  call<{ ok: boolean }>(`/shirt/claims/${encodeURIComponent(id)}/shipped`, { method: "POST", body: JSON.stringify({ shipped }) });
