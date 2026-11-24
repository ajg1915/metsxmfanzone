import { useCallback, useEffect, useState } from "react";
import { Download, Gift, Loader2, Package, RotateCcw, Truck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminPage, AdminPageHeader, AdminLoading, AdminEmpty } from "@/components/admin/AdminUI";
import {
  adminDownloadPirateShipCsv, adminImportTracking, adminOrders, adminRefund, adminShip, adminUpdateOrder, shopMoney,
  type AdminOrder, type OrderTotals,
} from "@/lib/shopApi";

const TABS = [
  { key: "paid", label: "To ship" },
  { key: "shipped", label: "Shipped" },
  { key: "all", label: "All" },
  { key: "merch", label: "Merch orders" },
];
const statusColor: Record<string, string> = {
  pending: "bg-muted text-muted-foreground", paid: "bg-primary text-primary-foreground", shipped: "bg-green-600 text-white",
  delivered: "bg-green-800 text-white", refunded: "bg-red-600 text-white", cancelled: "bg-zinc-600 text-white",
};
const when = (s: string | null) => (s ? new Date(s.replace(" ", "T") + (s.endsWith("Z") ? "" : "Z")).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

type MerchOrder = { id: string; status: string; customer_name: string; customer_email: string; total_amount: number; quantity: number; notes: string | null; created_at: string; shipping_city: string | null; shipping_state: string | null };

export default function ShopOrders() {
  const { toast } = useToast();
  const [tab, setTab] = useState("paid");
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [merch, setMerch] = useState<MerchOrder[] | null>(null);
  const [totals, setTotals] = useState<OrderTotals | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<AdminOrder | null>(null);
  const [carrier, setCarrier] = useState("USPS");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : String(e), variant: "destructive" });

  const load = useCallback(async () => {
    setError("");
    try {
      if (tab === "merch") {
        const { data, error: err } = await (supabase as any).from("shop_orders").select("id,status,customer_name,customer_email,total_amount,quantity,notes,created_at,shipping_city,shipping_state").order("created_at", { ascending: false }).limit(200);
        if (err) throw err;
        setMerch(data || []);
      } else {
        const r = await adminOrders(tab);
        setOrders(r.orders); setTotals(r.totals);
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [tab]);
  useEffect(() => { setOrders(null); setMerch(null); load(); }, [load]);

  const openOrder = (o: AdminOrder) => { setOpen(o); setTracking(o.tracking_number || ""); setCarrier(o.carrier || "USPS"); setNote(o.note || ""); };
  const run = async (what: string, fn: () => Promise<AdminOrder>, done: string) => {
    setBusy(what);
    try { const o = await fn(); setOpen(o); toast({ title: done }); load(); } catch (e) { fail("Couldn't do that", e); } finally { setBusy(""); }
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy("import");
    try {
      const r = await adminImportTracking(await f.text());
      toast({ title: `${r.shipped.length} order(s) marked shipped`, description: r.skipped.length ? `Skipped: ${r.skipped.join("; ")}` : "Customers were emailed their tracking." });
      load();
    } catch (e) { fail("Import failed", e); } finally { setBusy(""); }
  };

  return (
    <AdminPage>
      <AdminPageHeader icon={Package} title="Shop Orders" description="Orders from metsxmfanzone.com/shop. Ship them with Pirate Ship."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy === "export"} onClick={async () => { setBusy("export"); try { await adminDownloadPirateShipCsv(); } catch (e) { fail("Export failed", e); } finally { setBusy(""); } }}>
              <Download className="mr-1 h-4 w-4" />Export for Pirate Ship
            </Button>
            <Button size="sm" variant="outline" asChild disabled={busy === "import"}>
              <label className="cursor-pointer">{busy === "import" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}Import tracking<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            </Button>
          </div>
        } />

      {totals && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" style={{ fontVariantNumeric: "tabular-nums" }}>
          {[["To ship", String(totals.to_ship)], ["Today", shopMoney(totals.today)], ["This month", shopMoney(totals.month)], ["All time", shopMoney(totals.all_time)]].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border/40 bg-card/60 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p><p className="text-xl font-extrabold">{v}</p></div>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t.label}</button>
        ))}
      </div>

      {error && <AdminEmpty message={error} />}
      {tab !== "merch" && !orders && !error && <AdminLoading />}
      {tab !== "merch" && orders?.length === 0 && <AdminEmpty message={tab === "paid" ? "Nothing to ship right now." : "No orders here yet."} />}
      {tab !== "merch" && (
        <div className="grid gap-2">
          {orders?.map((o) => (
            <button key={o.id} type="button" onClick={() => openOrder(o)} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3 text-left hover:border-primary/50">
              <img src={o.items[0]?.image} alt="" className="h-14 w-11 flex-shrink-0 rounded-md bg-muted object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{o.ship_to.name} · {o.items.reduce((t, i) => t + i.qty, 0)} item(s) {o.gift_wrap && <Gift className="ml-1 inline h-3.5 w-3.5 text-primary" />}</p>
                <p className="truncate text-xs text-muted-foreground">{o.id} · {when(o.paid_at || o.created_at)} · {o.ship_to.city}, {o.ship_to.state}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{shopMoney(o.total)}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[o.status] || "bg-muted"}`}>{o.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "merch" && !merch && !error && <AdminLoading />}
      {tab === "merch" && merch?.length === 0 && <AdminEmpty message="No merch orders." />}
      {tab === "merch" && (
        <div className="grid gap-2">
          {merch?.map((o) => (
            <div key={o.id} className="rounded-xl border border-border/40 bg-card/60 p-3 text-sm">
              <div className="flex justify-between gap-2"><b className="truncate">{o.customer_name}</b><span className="font-bold">{shopMoney(Number(o.total_amount))}</span></div>
              <p className="text-xs text-muted-foreground">{o.status} · {new Date(o.created_at).toLocaleDateString()} · {o.shipping_city}, {o.shipping_state} · {o.customer_email}</p>
              {o.notes && <p className="mt-1 whitespace-pre-line text-xs">{o.notes}</p>}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Merch orders are shown here to view only.</p>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => { if (!o && !busy) setOpen(null); }}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <DialogHeader><DialogTitle>Order {open.id}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${statusColor[open.status] || "bg-muted"}`}>{open.status}</span>
                  <span className="text-muted-foreground">Paid {when(open.paid_at)} with {open.payment_method === "stripe" ? "card" : "PayPal"}</span>
                </div>
                <ul className="space-y-1.5">
                  {open.items.map((i) => (
                    <li key={i.title + i.size} className="flex items-center gap-2"><img src={i.image} alt="" className="h-12 w-9 rounded object-cover" /><span className="flex-1">{i.title} · <b>{i.size}</b> × {i.qty}</span><span>{shopMoney(i.price * i.qty)}</span></li>
                  ))}
                </ul>
                <p style={{ fontVariantNumeric: "tabular-nums" }}>Shipping {shopMoney(open.shipping)} · <b>Total {shopMoney(open.total)}</b>{open.refunded > 0 && <span className="text-red-500"> · Refunded {shopMoney(open.refunded)}</span>}</p>
                {open.gift_wrap && <p className="rounded-lg bg-primary/15 p-2 font-semibold"><Gift className="mr-1 inline h-4 w-4" />Gift wrap{open.gift_note ? `: "${open.gift_note}"` : ""}</p>}
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="font-semibold">{open.ship_to.name}</p>
                  <p>{open.address.line1}{open.address.line2 ? `, ${open.address.line2}` : ""}</p>
                  <p>{open.address.city}, {open.address.state} {open.address.zip}</p>
                  <p className="text-muted-foreground">{open.email}</p>
                </div>

                {(open.status === "paid" || open.status === "shipped") && (
                  <div className="space-y-2 rounded-lg border border-border/50 p-2">
                    <Label className="flex items-center gap-1"><Truck className="h-4 w-4" />Tracking from Pirate Ship</Label>
                    <div className="flex gap-2">
                      <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm"><option>USPS</option><option>UPS</option></select>
                      <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" />
                    </div>
                    <Button className="w-full" disabled={!!busy} onClick={() => run("ship", () => adminShip(open.id, carrier, tracking), "Marked shipped. Customer emailed.")}>
                      {busy === "ship" ? <Loader2 className="h-4 w-4 animate-spin" /> : open.status === "shipped" ? "Update tracking" : "Mark shipped & email customer"}
                    </Button>
                    {open.tracking_url && <a href={open.tracking_url} target="_blank" rel="noreferrer" className="block text-center text-xs text-primary underline">Track {open.tracking_number}</a>}
                  </div>
                )}

                <div><Label>Private note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("note", () => adminUpdateOrder(open.id, { note }), "Note saved")}>Save note</Button>
                  {open.status === "shipped" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("st", () => adminUpdateOrder(open.id, { status: "delivered", note }), "Marked delivered")}>Mark delivered</Button>}
                  {open.paid_at && open.refunded < open.total && (
                    <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => {
                      const left = open.total - open.refunded;
                      const v = window.prompt(`Refund how much? Leave as is for the full ${shopMoney(left)}. This sends the money back to the customer and can't be undone.`, left.toFixed(2));
                      if (v === null) return;
                      const amt = Number(v);
                      if (!(amt > 0)) return;
                      run("refund", () => adminRefund(open.id, amt), `Refunded ${shopMoney(amt)}`);
                    }}><RotateCcw className="mr-1 h-3.5 w-3.5" />Refund</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
