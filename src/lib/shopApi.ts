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
