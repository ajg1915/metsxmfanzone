import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Package } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { capturePayPal, getOrder, saveCart, shopMoney, type ShopOrder } from "@/lib/shopApi";

export default function ShopThanks() {
  const [params] = useSearchParams();
  const id = params.get("order") || "";
  const key = params.get("key") || "";
  const paypalToken = params.get("token");
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        let o = paypalToken ? await capturePayPal(id, key) : await getOrder(id, key);
        // Card payments are confirmed by Stripe a moment later; wait for it.
        for (let i = 0; i < 10 && o.status === "pending" && !stop; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          o = await getOrder(id, key);
        }
        if (stop) return;
        if (o.status !== "pending") saveCart([]);
        setOrder(o);
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { stop = true; };
  }, [id, key, paypalToken]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-lg px-4 pb-20 pt-28 text-center">
        {!order && !err && (<><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /><p className="mt-4 text-muted-foreground">Confirming your payment… don't close this page.</p></>)}
        {err && (<><Package className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-3 text-2xl font-extrabold">We couldn't confirm that payment</h1><p className="mt-2 text-muted-foreground">{err}</p><p className="mt-2 text-sm text-muted-foreground">If you were charged, email support@metsxmfanzone.com with order {id}.</p></>)}
        {order && (
          <>
            {order.status === "pending" ? <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /> : <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />}
            <h1 className="mt-3 text-2xl font-extrabold">{order.status === "pending" ? "Payment still processing" : "Thanks for your order!"}</h1>
            <p className="mt-1 text-muted-foreground">Order <b className="text-foreground">{order.id}</b>. A receipt is on its way to your email, and we'll send tracking when it ships.</p>
            <ul className="mt-6 space-y-2 text-left">
              {order.items.map((i) => (
                <li key={i.title + i.size} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-2">
                  <img src={i.image} alt="" className="h-14 w-11 rounded-md object-cover" />
                  <span className="flex-1 text-sm">{i.title} · {i.size} × {i.qty}</span>
                  <span className="text-sm font-bold">{shopMoney(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right text-sm">Shipping {shopMoney(order.shipping)} · <b>Total {shopMoney(order.total)}</b></p>
            <Link to="/shop" className="mt-8 inline-flex h-11 items-center rounded-xl bg-primary px-6 font-bold text-primary-foreground">Back to the shop</Link>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
