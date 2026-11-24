import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { ComingSoonCard, StoreCard, StoreHero, storeGrid } from "@/components/shop/StoreChrome";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  loadCart, saveCart, shopConfig, shopMoney, shopProducts, startCard, startPayPal,
  type CartLine, type Customer, type ShopProduct,
} from "@/lib/shopApi";

const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR".split(" ");
const field = "h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-[15px] text-white placeholder:text-white/40 focus:border-primary focus:outline-none";

function ProductDialog({ p, onClose, onAdd }: { p: ShopProduct | null; onClose: () => void; onAdd: (line: CartLine) => void }) {
  const [img, setImg] = useState(0);
  const [size, setSize] = useState("");
  useEffect(() => { setImg(0); setSize(""); }, [p?.id]);
  if (!p) return null;
  return (
    <Dialog open={!!p} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92svh] overflow-y-auto border-white/10 bg-[#0b1426] text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6 text-xl leading-tight">{p.title}</DialogTitle>
          <DialogDescription className="text-white/60">{p.condition}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="aspect-[4/5] overflow-hidden rounded-xl bg-[#e9ecf1]">
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
                  className={`min-h-[40px] rounded-lg border px-3 text-[13px] font-bold disabled:cursor-not-allowed disabled:line-through disabled:opacity-35 ${size === s.size ? "border-primary bg-primary text-primary-foreground" : "border-white/20 hover:border-primary/60"}`}>
                  {s.size}
                </button>
              ))}
            </div>
            {p.gift_wrap && <p className="mt-3 flex items-center gap-1.5 text-xs text-white/70"><Gift className="h-3.5 w-3.5 text-primary" /> Free Christmas gift wrap available at checkout</p>}
            <button type="button" disabled={p.sold_out || !size}
              onClick={() => { onAdd({ slug: p.slug, title: p.title, size, qty: 1, price: p.price, image: p.images[0] || "" }); onClose(); }}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-extrabold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
              <ShoppingCart className="h-5 w-5" /> {p.sold_out ? "Sold out" : size ? "Add to cart" : "Pick a size"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const blankCustomer: Customer = { name: "", email: "", address1: "", address2: "", city: "", state: "NY", zip: "" };

function CartDialog({ open, onClose, cart, setCart }: { open: boolean; onClose: () => void; cart: CartLine[]; setCart: (c: CartLine[]) => void }) {
  const { data: cfg } = useQuery({ queryKey: ["shop-config"], queryFn: shopConfig, staleTime: 300_000 });
  const [c, setC] = useState<Customer>(blankCustomer);
  const [gift, setGift] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "paypal" | "card">("");
  const [err, setErr] = useState("");
  const shipping = cfg?.shipping ?? 5.99;
  const subtotal = cart.reduce((t, l) => t + l.price * l.qty, 0);
  const set = (k: keyof Customer, v: string) => setC((x) => ({ ...x, [k]: v }));
  const qty = (i: number, d: number) => setCart(cart.map((l, j) => (j === i ? { ...l, qty: Math.max(1, Math.min(10, l.qty + d)) } : l)));

  const pay = async (kind: "paypal" | "card") => {
    setErr(""); setBusy(kind);
    try {
      const body = { customer: c, items: cart.map(({ slug, size, qty }) => ({ slug, size, qty })), gift_wrap: gift, gift_note: note };
      const url = kind === "paypal" ? (await startPayPal(body)).approve_url : (await startCard(body)).checkout_url;
      if (!url) throw new Error("Couldn't open checkout. Please try again.");
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[92svh] overflow-y-auto border-white/10 bg-[#0b1426] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your cart</DialogTitle>
          <DialogDescription className="text-white/60">US shipping only · {shopMoney(shipping)} flat rate</DialogDescription>
        </DialogHeader>
        {cart.length === 0 ? <p className="py-6 text-center text-white/60">Your cart is empty.</p> : (
          <>
            <ul className="space-y-2">
              {cart.map((l, i) => (
                <li key={l.slug + l.size} className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
                  <img src={l.image} alt="" className="h-14 w-11 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.title}</p>
                    <p className="text-xs text-white/60">{l.size} · {shopMoney(l.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="One less" onClick={() => qty(i, -1)} className="rounded-md p-1.5 hover:bg-white/10"><Minus className="h-4 w-4" /></button>
                    <span className="w-5 text-center text-sm font-bold">{l.qty}</span>
                    <button type="button" aria-label="One more" onClick={() => qty(i, 1)} className="rounded-md p-1.5 hover:bg-white/10"><Plus className="h-4 w-4" /></button>
                    <button type="button" aria-label="Remove" onClick={() => setCart(cart.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-white/60 hover:bg-white/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-white/10 pt-3 text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
              <div className="flex justify-between"><span className="text-white/70">Subtotal</span><span>{shopMoney(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-white/70">Shipping</span><span>{shopMoney(shipping)}</span></div>
              <div className="flex justify-between text-base font-extrabold"><span>Total</span><span className="text-primary">{shopMoney(subtotal + shipping)}</span></div>
            </div>
            <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
              <p className="pt-1 text-xs font-bold uppercase tracking-wide text-white/60">Ship to</p>
              <input className={field} placeholder="Full name" autoComplete="name" value={c.name} onChange={(e) => set("name", e.target.value)} />
              <input className={field} placeholder="Email (for your receipt and tracking)" type="email" autoComplete="email" value={c.email} onChange={(e) => set("email", e.target.value)} />
              <input className={field} placeholder="Street address" autoComplete="address-line1" value={c.address1} onChange={(e) => set("address1", e.target.value)} />
              <input className={field} placeholder="Apt, suite (optional)" autoComplete="address-line2" value={c.address2} onChange={(e) => set("address2", e.target.value)} />
              <div className="grid grid-cols-[1fr_88px_104px] gap-2">
                <input className={field} placeholder="City" autoComplete="address-level2" value={c.city} onChange={(e) => set("city", e.target.value)} />
                <select className={field} aria-label="State" autoComplete="address-level1" value={c.state} onChange={(e) => set("state", e.target.value)}>
                  {STATES.map((s) => <option key={s} value={s} className="bg-[#0b1426]">{s}</option>)}
                </select>
                <input className={field} placeholder="ZIP" inputMode="numeric" autoComplete="postal-code" value={c.zip} onChange={(e) => set("zip", e.target.value)} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm">
                <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} className="h-4 w-4 accent-[#FF5910]" />
                <Gift className="h-4 w-4 text-primary" /> Wrap it as a Christmas gift (free)
              </label>
              {gift && <input className={field} maxLength={300} placeholder="Gift note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />}
            </form>
            {err && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{err}</p>}
            <div className="space-y-2">
              {cfg?.paypal !== false && (
                <button type="button" disabled={!!busy} onClick={() => pay("paypal")} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFC439] text-base font-extrabold text-[#111] disabled:opacity-60">
                  {busy === "paypal" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Pay with PayPal"}
                </button>
              )}
              {cfg?.card && (
                <button type="button" disabled={!!busy} onClick={() => pay("card")} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-extrabold text-primary-foreground disabled:opacity-60">
                  {busy === "card" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Pay with card"}
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const Shop = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ["shop-products"], queryFn: shopProducts, staleTime: 60_000 });
  const [open, setOpen] = useState<ShopProduct | null>(null);
  const [cart, setCartState] = useState<CartLine[]>(() => loadCart());
  const [cartOpen, setCartOpen] = useState(false);
  const setCart = (c: CartLine[]) => { setCartState(c); saveCart(c); };
  const products = useMemo(() => data ?? [], [data]);
  const count = cart.reduce((t, l) => t + l.qty, 0);
  const add = (line: CartLine) => {
    const i = cart.findIndex((l) => l.slug === line.slug && l.size === line.size);
    setCart(i >= 0 ? cart.map((l, j) => (j === i ? { ...l, qty: Math.min(10, l.qty + 1) } : l)) : [...cart, line]);
    setCartOpen(true);
  };
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Mets T-Shirts & Gear | MetsXMFanZone Shop" description="New York Mets T-shirts and fan gear from the MetsXMFanZone shop. $5.99 flat shipping, free gift wrap." canonical="https://metsxmfanzone.com/shop" />
      <Navigation />
      <main className="mx-auto max-w-6xl px-3 pb-28 pt-20 sm:px-4 md:pt-28">
        <StoreHero title="Mets Shop" subtitle="Mets T-shirts and fan gear, packed and shipped by MetsXMFanZone."
          perks={[{ icon: "truck", text: "$5.99 flat U.S. shipping" }, { icon: "gift", text: "Free gift wrap" }, { icon: "shield", text: "Secure PayPal checkout" }]} />
        {isLoading && <div className={storeGrid}>{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[4/6] animate-pulse rounded-2xl bg-white/5" />)}</div>}
        {isError && <p className="mt-10 text-center text-muted-foreground">The shop is taking a break. Please check back soon.</p>}
        {!isLoading && !isError && products.length === 0 && <p className="mt-10 text-center text-muted-foreground">New Mets gear is on the way.</p>}
        {products.length > 0 && (
          <section className={storeGrid} aria-label="Mets shop products">
            {products.map((p) => (
              <StoreCard key={p.id} image={p.images[0]} altImage={p.images[1]} title={p.title} price={shopMoney(p.price)}
                badge={p.condition} soldOut={p.sold_out} meta={p.sizes.filter((s) => s.in_stock).map((s) => s.size).join(" · ")} onOpen={() => setOpen(p)} />
            ))}
            {products.length < 4 && <ComingSoonCard />}
          </section>
        )}
      </main>
      {count > 0 && (
        <button type="button" onClick={() => setCartOpen(true)} className="fixed bottom-[92px] left-1/2 z-40 flex h-13 -translate-x-1/2 items-center gap-2 rounded-full bg-[#FF5910] px-6 py-3.5 font-extrabold text-white shadow-[0_10px_30px_rgba(255,89,16,0.45)] md:bottom-8 md:left-auto md:right-8 md:translate-x-0">
          <ShoppingCart className="h-5 w-5" /> View cart · {count}
        </button>
      )}
      <ProductDialog p={open} onClose={() => setOpen(null)} onAdd={add} />
      <CartDialog open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} setCart={setCart} />
      <Footer />
    </div>
  );
};

export default Shop;
