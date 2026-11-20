// MetsXMFanZone's own gear. Prices are charged by size.
// IMPORTANT: the same price table lives in supabase/functions/create-shop-order/index.ts
// (the server recomputes the price, so the page can never set its own price).

export type MerchSku = "tshirt" | "longsleeve" | "hoodie" | "jacket" | "cap";

export type MerchItem = {
  sku: MerchSku;
  title: string;
  blurb: string;
  image: string;
  sizes: string[];
};

const ADULT = ["S", "M", "L", "XL", "2XL", "3XL"];

export const MERCH: MerchItem[] = [
  { sku: "tshirt", title: "MetsXMFanZone T-Shirt", blurb: "Soft tee with the MetsXMFanZone logo.", image: "/merch/tshirt.jpg", sizes: ADULT },
  { sku: "longsleeve", title: "MetsXMFanZone Long Sleeve", blurb: "Long sleeve tee for the cold games.", image: "/merch/longsleeve.jpg", sizes: ADULT },
  { sku: "hoodie", title: "MetsXMFanZone Hoodie", blurb: "Pullover hoodie, one price in every size.", image: "/merch/hoodie.jpg", sizes: ADULT },
  { sku: "jacket", title: "MetsXMFanZone Jacket", blurb: "Zip jacket, one price in every size.", image: "/merch/jacket.jpg", sizes: ADULT },
  { sku: "cap", title: "MetsXMFanZone Cap", blurb: "Adjustable cap with the logo.", image: "/merch/cap.jpg", sizes: ["One size"] },
];

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
