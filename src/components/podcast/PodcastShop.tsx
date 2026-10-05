import { useEffect, useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A few featured MetsXMFanZone Shop items, paid with PayPal.
// Orders go through the existing create-shop-order / capture-shop-order functions.

const FEATURED_IDS = [
  "6bfd727a-2976-481a-8fe8-3233d4aaf237", // MetsXMFanZone t-shirt
  "d2389471-dbf0-4cb3-9fb8-e09c3c79f764", // Black fitted hat
  "e1e09a50-ea14-4c7d-99dd-61e602d1041f", // Bichette tee
  "a672b001-526e-4e34-88e5-fa97c27816a5", // Robert Jr. tee
];

type Product = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  stock_quantity: number | null;
};

const money = (n: number) => `$${Number(n).toFixed(2)}`;

const field =
  "h-11 border-white/15 bg-white/5 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-primary";

export default function PodcastShop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [buying, setBuying] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", line1: "", line2: "", city: "", state: "", zip: "" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shop_products")
        .select("id, title, price, image_url, stock_quantity")
        .eq("published", true)
        .in("id", FEATURED_IDS);
      if (data) {
        const rows = data as Product[];
        setProducts(FEATURED_IDS.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Product[]);
      }
    })();
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buying) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("create-shop-order", {
        body: {
          productId: buying.id,
          quantity: 1,
          customerName: form.name.trim(),
          customerEmail: form.email.trim(),
          shippingAddress: {
            line1: form.line1.trim(),
            line2: form.line2.trim(),
            city: form.city.trim(),
            state: form.state.trim().toUpperCase(),
            zip: form.zip.trim(),
            country: "US",
          },
          returnOrigin: window.location.origin,
        },
      });
      if (err || !data?.approvalUrl) throw new Error(data?.error || err?.message || "Couldn't start checkout");
      window.location.href = data.approvalUrl;
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  if (products.length === 0) return null;

  return (
    <section aria-labelledby="pod-shop" className="py-8 sm:py-10">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="mx-eyebrow mb-1.5 !text-primary">The Shop</p>
          <h2 id="pod-shop" className="font-display text-[30px] uppercase leading-none tracking-wide text-foreground sm:text-4xl">
            MetsXMFanZone Gear
          </h2>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
          <ShoppingBag className="h-3.5 w-3.5" /> Pay securely with PayPal
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.map((p) => {
          const soldOut = p.stock_quantity !== null && p.stock_quantity < 1;
          return (
            <div key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 transition-colors hover:border-primary/50">
              <div className="aspect-square overflow-hidden bg-[#0d1b30]">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground"><ShoppingBag className="h-10 w-10" /></div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground sm:text-[15px]">{p.title.trim()}</h3>
                <p className="mb-3 mt-1 text-lg font-extrabold text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>{money(p.price)}</p>
                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => { setError(""); setBuying(p); }}
                  className="mt-auto flex h-11 w-full items-center justify-center rounded-xl bg-[#ffc439] text-[15px] font-extrabold text-[#111] transition-colors hover:bg-[#f2b920] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                >
                  {soldOut ? "Sold out" : "Buy with PayPal"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!buying} onOpenChange={(o) => { if (!o && !busy) setBuying(null); }}>
        <DialogContent className="max-h-[92svh] overflow-y-auto border-white/10 bg-[#0b1426] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Where should we ship it?</DialogTitle>
            <DialogDescription className="text-white/60">
              {buying?.title.trim()} · {buying ? money(buying.price) : ""} · U.S. shipping address. You'll pay on PayPal next.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div><Label htmlFor="s-name" className="mb-1 block text-white/80">Full name</Label><Input id="s-name" required autoComplete="name" value={form.name} onChange={set("name")} className={field} /></div>
            <div><Label htmlFor="s-email" className="mb-1 block text-white/80">Email</Label><Input id="s-email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} className={field} /></div>
            <div><Label htmlFor="s-l1" className="mb-1 block text-white/80">Address</Label><Input id="s-l1" required autoComplete="address-line1" value={form.line1} onChange={set("line1")} className={field} /></div>
            <div><Label htmlFor="s-l2" className="mb-1 block text-white/80">Apt / suite (optional)</Label><Input id="s-l2" autoComplete="address-line2" value={form.line2} onChange={set("line2")} className={field} /></div>
            <div className="grid grid-cols-[1fr_72px_96px] gap-2">
              <div><Label htmlFor="s-city" className="mb-1 block text-white/80">City</Label><Input id="s-city" required autoComplete="address-level2" value={form.city} onChange={set("city")} className={field} /></div>
              <div><Label htmlFor="s-st" className="mb-1 block text-white/80">State</Label><Input id="s-st" required maxLength={2} autoComplete="address-level1" value={form.state} onChange={set("state")} className={`${field} uppercase`} /></div>
              <div><Label htmlFor="s-zip" className="mb-1 block text-white/80">ZIP</Label><Input id="s-zip" required inputMode="numeric" autoComplete="postal-code" value={form.zip} onChange={set("zip")} className={field} /></div>
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ffc439] text-base font-extrabold text-[#111] hover:bg-[#f2b920] disabled:opacity-70">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening PayPal…</> : "Continue to PayPal"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
