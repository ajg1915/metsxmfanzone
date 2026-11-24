import { supabase } from "@/integrations/supabase/client";

// The Mets Shop (/shop) runs on the owner's Cloudflare Worker "mets-shop"
// (cloudflare/mets-shop-worker.js) with a D1 database. Nothing here touches Supabase
// except reading the admin's login token.
export const SHOP_API = "https://mets-shop.metsxmfan.workers.dev";

export type ShopSize = { size: string; in_stock: boolean; stock?: number | null };
export type ShopProduct = {
  id: number;
  slug: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  condition: string;
  gift_wrap: boolean;
  sizes: ShopSize[];
  sold_out: boolean;
  published?: boolean;
  sort?: number;
  weight_oz?: number;
};

export const shopMoney = (n: number) => `$${n.toFixed(2)}`;

async function call<T>(path: string, init?: RequestInit, admin = false): Promise<T> {
  const headers: Record<string, string> = { ...(init?.body ? { "Content-Type": "application/json" } : {}) };
  if (admin) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Not signed in");
    headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${SHOP_API}${path}`, { ...init, headers });
  } catch {
    throw new Error("Can't reach the shop service. Check your connection, or that the mets-shop Worker is deployed.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Shop error (${res.status})`);
  return body as T;
}

export const shopProducts = () => call<{ products: ShopProduct[] }>("/products").then((r) => r.products);
export const adminShopProducts = () => call<{ products: ShopProduct[] }>("/admin/products", undefined, true).then((r) => r.products);

export type ProductInput = {
  title?: string;
  description?: string;
  price?: number;
  images?: string[];
  sizes?: { size: string; stock: number | null }[];
  category?: string;
  condition?: string;
  gift_wrap?: boolean;
  weight_oz?: number;
  published?: boolean;
  sort?: number;
};
export const adminCreateProduct = (p: ProductInput) =>
  call<{ product: ShopProduct }>("/admin/products", { method: "POST", body: JSON.stringify(p) }, true).then((r) => r.product);
export const adminUpdateProduct = (id: number, p: ProductInput) =>
  call<{ product: ShopProduct }>(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(p) }, true).then((r) => r.product);

// ---------- cart + checkout ----------
export type CartLine = { slug: string; title: string; size: string; qty: number; price: number; image: string };
const CART_KEY = "mets-shop-cart";
export const loadCart = (): CartLine[] => {
  try { const v = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};
export const saveCart = (c: CartLine[]) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch { /* private mode */ } };

export type Customer = { name: string; email: string; address1: string; address2: string; city: string; state: string; zip: string };
export type CheckoutBody = { customer: Customer; items: { slug: string; size: string; qty: number }[]; gift_wrap: boolean; gift_note: string };
export const shopConfig = () => call<{ shipping: number; paypal: boolean; card: boolean }>("/checkout/config");
export const startPayPal = (b: CheckoutBody) => call<{ order_id: string; approve_url: string }>("/checkout/paypal", { method: "POST", body: JSON.stringify(b) });
export const startCard = (b: CheckoutBody) => call<{ order_id: string; checkout_url: string }>("/checkout/stripe", { method: "POST", body: JSON.stringify(b) });

export type ShopOrder = {
  id: string; status: string; created_at: string; paid_at: string | null; shipped_at: string | null;
  items: { title: string; size: string; qty: number; price: number; image: string }[];
  subtotal: number; shipping: number; total: number; gift_wrap: boolean;
  ship_to: { name: string; city: string; state: string };
  carrier: string | null; tracking_number: string | null; tracking_url: string | null;
};
export const capturePayPal = (order: string, key: string) => call<{ order: ShopOrder }>("/checkout/paypal/capture", { method: "POST", body: JSON.stringify({ order, key }) }).then((r) => r.order);
export const getOrder = (order: string, key: string) => call<{ order: ShopOrder }>(`/orders/${encodeURIComponent(order)}?key=${encodeURIComponent(key)}`).then((r) => r.order);

// ---------- admin orders ----------
export type AdminOrder = ShopOrder & {
  email: string; address: { line1: string; line2: string; city: string; state: string; zip: string };
  gift_note: string; payment_method: string; payment_ref: string; refunded: number; note: string;
};
export type OrderTotals = { today: number; month: number; all_time: number; to_ship: number };
export const adminOrders = (status = "") => call<{ orders: AdminOrder[]; totals: OrderTotals }>(`/admin/orders${status ? `?status=${status}` : ""}`, undefined, true);
export const adminShip = (id: string, carrier: string, tracking: string) =>
  call<{ order: AdminOrder }>(`/admin/orders/${id}/ship`, { method: "POST", body: JSON.stringify({ carrier, tracking }) }, true).then((r) => r.order);
export const adminRefund = (id: string, amount?: number) =>
  call<{ order: AdminOrder }>(`/admin/orders/${id}/refund`, { method: "POST", body: JSON.stringify({ amount }) }, true).then((r) => r.order);
export const adminUpdateOrder = (id: string, body: { note?: string; status?: string }) =>
  call<{ order: AdminOrder }>(`/admin/orders/${id}`, { method: "PUT", body: JSON.stringify(body) }, true).then((r) => r.order);
export const adminImportTracking = async (csv: string) => {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${SHOP_API}/admin/orders/import-tracking`, { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token}`, "Content-Type": "text/csv" }, body: csv });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || "Import failed");
  return body as { shipped: string[]; skipped: string[] };
};
export const adminDownloadPirateShipCsv = async () => {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${SHOP_API}/admin/orders/export.csv`, { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
  if (!res.ok) throw new Error("Couldn't build the export");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pirate-ship-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
