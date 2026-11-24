import { useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { COLORS, MERCH, merchFrom, merchImage, merchMoney, merchPrice, type MerchItem } from "@/lib/merchCatalog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StoreCard, storeGrid, storeSheet } from "@/components/shop/StoreChrome";
import { Label } from "@/components/ui/label";

// MetsXMFanZone gear, paid with PayPal. Price depends on size and is re-checked on the server.

const field =
  "h-11 min-w-0 border-white/15 bg-white/5 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-primary";

export default function PodcastShop({ all = false }: { all?: boolean }) {
  const items = (all ? MERCH : MERCH.filter((m) => ["tshirt", "hoodie", "jacket", "cap"].includes(m.sku))).filter((m) => !m.hidden);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [colors, setColors] = useState<Record<string, string>>({});
  const [designs, setDesigns] = useState<Record<string, string>>({});
  const [buying, setBuying] = useState<MerchItem | null>(null);
  const [step, setStep] = useState<"pick" | "ship">("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", line1: "", line2: "", city: "", state: "", zip: "" });

  const sizeOf = (m: MerchItem) => sizes[m.sku] || (m.sizes.length === 1 ? m.sizes[0] : "");
  const colorOf = (m: MerchItem) => colors[m.sku] || "royal";
  const designOf = (m: MerchItem) => designs[m.sku] || "logo";
  const size = buying ? sizeOf(buying) : "";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buying) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("create-shop-order", {
        body: {
          sku: buying.sku,
          size,
          color: colorOf(buying),
          design: designOf(buying),
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

  return (
    <section aria-labelledby="pod-shop" className={all ? "py-2" : "py-8 sm:py-10"}>
      {!all && (
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="mx-eyebrow mb-1.5 !text-primary">The Shop</p>
            <h2 id="pod-shop" className="font-display text-[30px] uppercase leading-none tracking-wide text-foreground sm:text-4xl">
              MetsXMFanZone Gear
            </h2>
          </div>
          <a href="/merch" className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ShoppingBag className="h-3.5 w-3.5" /> See all gear
          </a>
        </div>
      )}

      <div className={all ? storeGrid : "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4"}>
        {items.map((m) => (
          <StoreCard key={m.sku} image={merchImage(m.sku, colorOf(m), designOf(m))} title={m.title}
            price={m.sizes.length > 1 && merchFrom(m) !== merchPrice(m.sku, m.sizes[m.sizes.length - 1]) ? `From ${merchMoney(merchFrom(m))}` : merchMoney(merchFrom(m))}
            swatches={COLORS.map((c) => c.hex)} meta={m.sizes.length > 1 ? `${m.sizes[0]}–${m.sizes[m.sizes.length - 1]}` : m.sizes[0]}
            onOpen={() => { setError(""); setStep("pick"); setBuying(m); }} />
        ))}
      </div>

      <Dialog open={!!buying} onOpenChange={(o) => { if (!o && !busy) setBuying(null); }}>
        <DialogContent className={`${storeSheet} sm:max-w-2xl`}>
          {buying && step === "pick" && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6 text-xl leading-tight">{buying.title}</DialogTitle>
                <DialogDescription className="text-white/60">MetsXMFanZone gear · ships in the U.S.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="mx-auto aspect-square max-h-[34dvh] overflow-hidden rounded-xl bg-[#e9ecf1] sm:max-h-none">
                  <img src={merchImage(buying.sku, colorOf(buying), designOf(buying))} alt={`${buying.title} in ${COLORS.find((c) => c.id === colorOf(buying))?.label}`} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <p className="text-2xl font-extrabold text-[#FF5910]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {size ? merchMoney(merchPrice(buying.sku, size)) : buying.sizes.length > 1 ? `From ${merchMoney(merchFrom(buying))}` : merchMoney(merchFrom(buying))}
                  </p>
                  {buying.designs && (
                    <>
                      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-white/60">Design</p>
                      <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label="Design">
                        {buying.designs.map((d) => (
                          <button key={d.id} type="button" role="radio" aria-checked={designOf(buying) === d.id} onClick={() => setDesigns((p) => ({ ...p, [buying.sku]: d.id }))}
                            className={`min-h-[40px] flex-1 rounded-lg border px-3 text-[13px] font-bold ${designOf(buying) === d.id ? "border-[#FF5910] bg-[#FF5910] text-white" : "border-white/20 hover:border-[#FF5910]/60"}`}>{d.label}</button>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-white/60">Color · <span className="normal-case text-white/80">{COLORS.find((c) => c.id === colorOf(buying))?.label}</span></p>
                  <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="Color">
                    {COLORS.map((c) => (
                      <button key={c.id} type="button" role="radio" aria-checked={colorOf(buying) === c.id} aria-label={c.label} title={c.label}
                        onClick={() => setColors((p) => ({ ...p, [buying.sku]: c.id }))}
                        className={`h-9 w-9 rounded-full border-2 ${colorOf(buying) === c.id ? "border-[#FF5910] ring-2 ring-[#FF5910]/40 ring-offset-2 ring-offset-[#0b1426]" : "border-white/30"}`} style={{ backgroundColor: c.hex }} />
                    ))}
                  </div>
                  {buying.sizes.length > 1 ? (
                    <>
                      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-white/60">Size</p>
                      <div className="mt-1.5 grid grid-cols-6 gap-1.5 max-[360px]:grid-cols-3" role="radiogroup" aria-label="Size">
                        {buying.sizes.map((s) => (
                          <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => setSizes((p) => ({ ...p, [buying.sku]: s }))}
                            className={`min-h-[40px] rounded-lg border text-[13px] font-bold ${size === s ? "border-[#FF5910] bg-[#FF5910] text-white" : "border-white/20 hover:border-[#FF5910]/60"}`}>{s}</button>
                        ))}
                      </div>
                    </>
                  ) : <p className="mt-4 text-sm text-white/70">{buying.sizes[0]}</p>}
                  <button type="button" disabled={!size} onClick={() => setStep("ship")}
                    className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#ffc439] text-base font-extrabold text-[#111] hover:bg-[#f2b920] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40">
                    {size ? "Buy with PayPal" : "Pick a size"}
                  </button>
                </div>
              </div>
            </>
          )}
          {buying && step === "ship" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Where should we ship it?</DialogTitle>
                <DialogDescription className="text-white/60">
                  {buying.title}{buying.designs && designOf(buying) === "podcast" ? " (Podcast Shop design)" : ""} · {COLORS.find((c) => c.id === colorOf(buying))?.label} · Size {size} · {merchMoney(merchPrice(buying.sku, size))}. You'll pay on PayPal next.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label htmlFor="s-name" className="mb-1 block text-white/80">Full name</Label><Input id="s-name" required autoComplete="name" value={form.name} onChange={set("name")} className={field} /></div>
                  <div><Label htmlFor="s-email" className="mb-1 block text-white/80">Email</Label><Input id="s-email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} className={field} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div><Label htmlFor="s-l1" className="mb-1 block text-white/80">Address</Label><Input id="s-l1" required autoComplete="address-line1" value={form.line1} onChange={set("line1")} className={field} /></div>
                  <div><Label htmlFor="s-l2" className="mb-1 block text-white/80">Apt (optional)</Label><Input id="s-l2" autoComplete="address-line2" value={form.line2} onChange={set("line2")} className={field} /></div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_64px_92px] gap-2">
                  <div><Label htmlFor="s-city" className="mb-1 block text-white/80">City</Label><Input id="s-city" required autoComplete="address-level2" value={form.city} onChange={set("city")} className={field} /></div>
                  <div><Label htmlFor="s-st" className="mb-1 block text-white/80">State</Label><Input id="s-st" required maxLength={2} autoComplete="address-level1" value={form.state} onChange={set("state")} className={`${field} uppercase`} /></div>
                  <div><Label htmlFor="s-zip" className="mb-1 block text-white/80">ZIP</Label><Input id="s-zip" required inputMode="numeric" autoComplete="postal-code" value={form.zip} onChange={set("zip")} className={field} /></div>
                </div>
                {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => setStep("pick")} className="h-12 rounded-xl border border-white/20 px-4 font-bold text-white/80">Back</button>
                  <button type="submit" disabled={busy} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#ffc439] text-base font-extrabold text-[#111] hover:bg-[#f2b920] disabled:opacity-70">
                    {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening PayPal…</> : "Continue to PayPal"}
                  </button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
