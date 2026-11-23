import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, ShoppingBag } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shopMoney, shopProducts, type ShopProduct } from "@/lib/shopApi";

function ProductCard({ p, onOpen }: { p: ShopProduct; onOpen: () => void }) {
  const [front, back] = p.images;
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 text-left transition-colors hover:border-primary/50">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#0d1b30]">
        {front && <img src={front} alt={p.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0" />}
        {back && <img src={back} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
        {p.sold_out && <span className="absolute left-2 top-2 rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-bold uppercase text-white">Sold out</span>}
        {p.condition && !p.sold_out && <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">{p.condition}</span>}
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground sm:text-[15px]">{p.title}</h3>
        <p className="mt-1 text-lg font-extrabold text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>{shopMoney(p.price)}</p>
        <p className="mt-auto pt-1 text-xs text-muted-foreground">{p.sizes.filter((s) => s.in_stock).map((s) => s.size).join(" · ") || "Sold out"}</p>
      </div>
    </button>
  );
}

function ProductDialog({ p, onClose }: { p: ShopProduct | null; onClose: () => void }) {
  const [img, setImg] = useState(0);
  const [size, setSize] = useState("");
  const [gift, setGift] = useState(false);
  if (!p) return null;
  return (
    <Dialog open={!!p} onOpenChange={(o) => { if (!o) { onClose(); setImg(0); setSize(""); setGift(false); } }}>
      <DialogContent className="max-h-[92svh] overflow-y-auto border-white/10 bg-[#0b1426] text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6 text-xl leading-tight">{p.title}</DialogTitle>
          <DialogDescription className="text-white/60">{p.condition}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="aspect-[3/4] overflow-hidden rounded-xl bg-[#0d1b30]">
              {p.images[img] && <img src={p.images[img]} alt={p.title} className="h-full w-full object-cover" />}
            </div>
            {p.images.length > 1 && (
              <div className="mt-2 flex gap-2">
                {p.images.map((u, i) => (
                  <button key={u} type="button" onClick={() => setImg(i)} aria-label={`Photo ${i + 1}`} className={`h-16 w-12 overflow-hidden rounded-lg border-2 ${i === img ? "border-primary" : "border-transparent"}`}>
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <p className="text-2xl font-extrabold text-primary">{shopMoney(p.price)}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/80">{p.description}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-white/60">Size</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size">
              {p.sizes.map((s) => (
                <button key={s.size} type="button" role="radio" aria-checked={size === s.size} disabled={!s.in_stock} onClick={() => setSize(s.size)}
                  className={`min-h-[38px] rounded-lg border px-3 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through ${size === s.size ? "border-primary bg-primary text-primary-foreground" : "border-white/20 hover:border-primary/60"}`}>
                  {s.size}
                </button>
              ))}
            </div>
            {p.gift_wrap && (
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} className="h-4 w-4 accent-[#FF5910]" />
                <Gift className="h-4 w-4 text-primary" /> Wrap it as a Christmas gift
              </label>
            )}
            <button type="button" disabled className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-muted text-base font-extrabold text-muted-foreground">
              {p.sold_out ? "Sold out" : "Checkout opens soon"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Shop = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ["shop-products"], queryFn: shopProducts, staleTime: 60_000 });
  const [open, setOpen] = useState<ShopProduct | null>(null);
  const products = useMemo(() => data ?? [], [data]);
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Mets T-Shirts & Gear | MetsXMFanZone Shop" description="New York Mets T-shirts and fan gear from the MetsXMFanZone shop. Gift wrap available." canonical="https://metsxmfanzone.com/shop" />
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 md:pt-28">
        <header className="rounded-2xl border-t-4 border-t-primary bg-gradient-to-b from-[hsl(var(--mets-blue))] to-[hsl(var(--mets-blue-dark))] p-6 text-center text-white sm:p-10">
          <ShoppingBag className="mx-auto h-9 w-9 text-primary" />
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Mets Shop</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80 sm:text-base">Mets T-shirts and fan gear, shipped by MetsXMFanZone. Gift wrap available for the holidays.</p>
        </header>
        {isLoading && <p className="mt-10 text-center text-muted-foreground">Loading the shop…</p>}
        {isError && <p className="mt-10 text-center text-muted-foreground">The shop is taking a break. Please check back soon.</p>}
        {!isLoading && !isError && products.length === 0 && <p className="mt-10 text-center text-muted-foreground">New Mets gear is on the way.</p>}
        {products.length > 0 && (
          <section className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" aria-label="Mets shop products">
            {products.map((p) => <ProductCard key={p.id} p={p} onOpen={() => setOpen(p)} />)}
          </section>
        )}
      </main>
      <ProductDialog p={open} onClose={() => setOpen(null)} />
      <Footer />
    </div>
  );
};

export default Shop;
