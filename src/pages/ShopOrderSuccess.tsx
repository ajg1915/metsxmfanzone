import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";

// PayPal sends the buyer back here with ?token=<order id>. We capture the payment.
const ShopOrderSuccess = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"working" | "ok" | "fail">(token ? "working" : "fail");

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("capture-shop-order", { body: { paypalOrderId: token } });
      setState(!error && data?.success ? "ok" : "fail");
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Order | MetsXMFanZone Shop" description="Your MetsXMFanZone Shop order." noindex canonical="https://www.metsxmfanzone.com/shop/order-success" />
      <Navigation />
      <main className="flex min-h-[70svh] items-center justify-center px-4 pt-20 md:pt-24">
        <div className="max-w-md text-center">
          {state === "working" && (<><Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" /><h1 className="mt-4 text-2xl font-bold">Finishing your order…</h1><p className="mt-2 text-muted-foreground">Please don't close this page.</p></>)}
          {state === "ok" && (<><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /><h1 className="mt-4 text-2xl font-bold">Thank you! Your order is in.</h1><p className="mt-2 text-muted-foreground">PayPal will email your receipt. We'll get your gear on its way.</p></>)}
          {state === "fail" && (<><XCircle className="mx-auto h-14 w-14 text-red-400" /><h1 className="mt-4 text-2xl font-bold">We couldn't finish that order</h1><p className="mt-2 text-muted-foreground">You may not have been charged. If PayPal shows a charge, email us and we'll sort it out.</p></>)}
          <Link to="/podcast" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-6 font-bold text-primary-foreground">Back to the podcast</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ShopOrderSuccess;
