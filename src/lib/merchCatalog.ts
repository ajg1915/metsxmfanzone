// MetsXMFanZone's own gear. Prices are charged by size.
// IMPORTANT: the same price/option table lives in supabase/functions/create-shop-order/index.ts
// (the server recomputes the price, so the page can never set its own price).

export type MerchSku = "tshirt" | "longsleeve" | "hoodie" | "jacket" | "cap";

export const COLORS = [
  { id: "royal", label: "Royal Blue", hex: "#1c4fc8" },
  { id: "black", label: "Black", hex: "#1e2026" },
  { id: "gray", label: "Gray", hex: "#969aa2" },
  { id: "white", label: "White", hex: "#f2f2f0" },
] as const;
export type ColorId = (typeof COLORS)[number]["id"];

export type MerchItem = {
  sku: MerchSku;
  title: string;
  blurb: string;
  sizes: string[];
  designs?: { id: "logo" | "podcast"; label: string }[];
  hidden?: boolean; // not shown until we have photos for it
};

const ADULT = ["S", "M", "L", "XL", "2XL", "3XL"];
const DESIGNS = [
  { id: "logo" as const, label: "Logo" },
  { id: "podcast" as const, label: "Podcast Shop" },
];

export const MERCH: MerchItem[] = [
  { sku: "tshirt", title: "MetsXMFanZone T-Shirt", blurb: "Soft tee with the MetsXMFanZone logo.", sizes: ADULT },
  { sku: "hoodie", title: "MetsXMFanZone Hoodie", blurb: "Pullover hoodie, one price in every size.", sizes: ADULT, designs: DESIGNS },
  { sku: "jacket", title: "MetsXMFanZone Jacket", blurb: "Button-up varsity jacket, one price in every size.", sizes: ADULT },
  { sku: "cap", title: "MetsXMFanZone Cap", blurb: "Snapback cap with the logo.", sizes: ["One size"], designs: DESIGNS },
  { sku: "longsleeve", title: "MetsXMFanZone Long Sleeve", blurb: "Long sleeve tee.", sizes: ADULT, hidden: true },
];

export function merchImage(sku: MerchSku, color: string, design: string = "logo") {
  const base = sku === "longsleeve" ? "tshirt" : sku;
  return `/merch/${base}${design === "podcast" ? "-podcast" : ""}-${color}.jpg`;
}

export function merchPrice(sku: MerchSku, size: string): number {
  switch (sku) {
    case "tshirt":
    case "longsleeve":
      return ["2XL", "3XL"].includes(size) ? 26.99 : 24.56; // S-XL 24.56, 2XL and up 26.99
    case "hoodie":
    case "jacket":
      return 40;
    case "cap":
      return 15;
  }
}

export const merchFrom = (item: MerchItem) => Math.min(...item.sizes.map((s) => merchPrice(item.sku, s)));
export const merchMoney = (n: number) => `$${n.toFixed(2)}`;
