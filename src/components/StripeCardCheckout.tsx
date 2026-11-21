// Stripe's own card screen, shown inside the checkout box (Embedded Checkout).
// Loaded only when a fan picks "Pay with card", so PayPal-only visitors never download Stripe.
import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { STRIPE_PUBLISHABLE_KEY, cardCheckoutStatus, createCardCheckout } from "@/lib/stripeBilling";

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= loadStripe(STRIPE_PUBLISHABLE_KEY));

interface Props {
  planId: string;
  /** Membership is on (webhook confirmed). */
  onActivated: () => void;
  /** Card screen could not start (e.g. already subscribed); message is fan-friendly. */
  onError: (message: string, code?: string) => void;
}

const StripeCardCheckout = ({ planId, onActivated, onError }: Props) => {
  const sessionId = useRef<string>("");
  const [finishing, setFinishing] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    try {
      const { clientSecret, sessionId: id } = await createCardCheckout(planId);
      sessionId.current = id;
      return clientSecret;
    } catch (e) {
      const err = e as { message?: string; code?: string };
      onError(err.message || "Card checkout is unavailable right now.", err.code);
      throw e;
    }
  }, [planId, onError]);

  // Payment went through: wait (up to ~30s) for Stripe's webhook to switch the membership on.
  useEffect(() => {
    if (!finishing) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 15 && !cancelled; i++) {
        try {
          const s = await cardCheckoutStatus(sessionId.current);
          if (s.active) break;
        } catch {
          /* keep waiting */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) onActivated();
    })();
    return () => {
      cancelled = true;
    };
  }, [finishing, onActivated]);

  if (finishing) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-semibold text-foreground">Payment received</p>
        <p className="text-sm text-muted-foreground">Turning on your membership…</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden bg-white min-h-[420px]">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret, onComplete: () => setFinishing(true) }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
};

export default StripeCardCheckout;
