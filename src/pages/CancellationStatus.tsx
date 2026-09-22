import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, UserCheck, LifeBuoy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const CANCELLATION_RESULT_KEY = "mxfz_cancellation_result";

export type CancellationResult = {
  paypalConfirmed: boolean;
  accountRetained?: boolean;
  cancellationCount?: number;
  limitedAccess?: boolean;
  message?: string;
  error?: string;
  at?: string;
};

const StatusRow = ({
  ok,
  pendingLabel,
  icon,
  title,
  okText,
  failText,
}: {
  ok: boolean;
  pendingLabel?: string;
  icon: React.ReactNode;
  title: string;
  okText: string;
  failText: string;
}) => (
  <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 backdrop-blur p-4">
    <div className="mt-0.5 text-muted-foreground">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-semibold text-sm text-foreground">{title}</h2>
        <Badge variant={ok ? "default" : "destructive"} className="text-[10px]">
          {ok ? "Confirmed" : pendingLabel || "Not completed"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{ok ? okText : failText}</p>
    </div>
    {ok ? (
      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
    ) : (
      <XCircle className="w-5 h-5 text-destructive shrink-0" />
    )}
  </div>
);

const CancellationStatus = () => {
  const [result, setResult] = useState<CancellationResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const loadResult = async () => {
    try {
      const raw = sessionStorage.getItem(CANCELLATION_RESULT_KEY);
      if (raw) {
        setResult(JSON.parse(raw) as CancellationResult);
        setLoaded(true);
        return;
      }
    } catch (_) {
      /* ignore malformed state */
    }
    if (user) {
      const { data } = await supabase.from("subscription_activity")
        .select("action, created_at").eq("user_id", user.id)
        .eq("action", "membership_cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setResult({ paypalConfirmed: true, accountRetained: true, at: data.created_at });
      }
    }
    setLoaded(true);
    };
    void loadResult();
  }, [user]);

  const allDone = !!result?.paypalConfirmed && !!result?.accountRetained;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Cancellation Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A step-by-step record of what happened when your membership was cancelled.
          </p>
        </header>

        {!loaded ? null : !result ? (
          <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No recent cancellation was found in this browser session. If you cancelled from
              PayPal directly, the change may still be processing.
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`rounded-xl border p-4 ${
                allDone
                  ? "border-primary/40 bg-primary/10"
                  : "border-destructive/40 bg-destructive/10"
              }`}
            >
              <p className="text-sm font-semibold text-foreground">
                {allDone
                  ? "Your membership is fully cancelled."
                  : "Your cancellation did not fully complete."}
              </p>
              {result.at && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Attempted {new Date(result.at).toLocaleString()}
                </p>
              )}
            </div>

            <StatusRow
              ok={result.paypalConfirmed}
              icon={<ShieldCheck className="w-5 h-5" />}
              title="PayPal billing cancelled"
              okText="PayPal confirmed the billing agreement is cancelled. No future charges will be made."
              failText={
                result.error ||
                "PayPal did not confirm the cancellation, so nothing was changed on your account."
              }
            />

            <StatusRow
              ok={Boolean(result.accountRetained)}
              pendingLabel={result.paypalConfirmed ? "Review" : "Not started"}
              icon={<UserCheck className="w-5 h-5" />}
              title="Account retained"
              okText={`Your account and history remain available. Cancellation count: ${result.cancellationCount || 1}.`}
              failText={
                result.paypalConfirmed
                  ? "Billing was stopped. Contact support if your account status does not update."
                  : "Your account remains unchanged because PayPal did not confirm cancellation."
              }
            />

            {!allDone && (
              <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur p-4">
                <div className="flex items-center gap-2 mb-2">
                  <LifeBuoy className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm text-foreground">Next steps</h2>
                </div>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
                  {!result.paypalConfirmed && (
                    <>
                      <li>
                        Try cancelling again from your dashboard in a few minutes — PayPal may have
                        been temporarily unreachable.
                      </li>
                      <li>
                        You can also cancel directly in PayPal under Settings → Payments → Automatic
                        Payments. We process that automatically once PayPal notifies us.
                      </li>
                    </>
                  )}
                  {result.paypalConfirmed && !result.accountRetained && (
                    <li>
                      Your billing is stopped, so you will not be charged again. Contact support to
                       confirm your retained account status.
                    </li>
                  )}
                  <li>
                    Still stuck? <Link to="/contact" className="text-primary underline">Contact support</Link>{" "}
                    and include the date and time shown above.
                  </li>
                </ol>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/">Go Home</Link>
              </Button>
               {result.accountRetained && (
                <Button asChild className="flex-1">
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CancellationStatus;
