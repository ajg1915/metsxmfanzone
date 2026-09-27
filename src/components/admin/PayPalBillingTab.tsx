import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type Item = {
  paypal_id: string;
  paypal_status: string;
  plan_name: string | null;
  price: string | null;
  last_payment: string | null;
  next_billing: string | null;
  failed_payments: number;
  member_id: string | null;
  member_name: string | null;
  member_email: string | null;
  site_plan: string | null;
  site_status: string | null;
  site_end_date: string | null;
  on_site: boolean;
  charged_last_31_days: boolean;
  issue: string | null;
  billed_twice?: boolean;
};

type Report = {
  generated_at: string;
  transactions_available: boolean;
  summary: {
    active_on_paypal: number;
    billed_twice: number;
    not_on_site: number;
    charging_but_site_ended: number;
    site_active_but_paypal_stopped: number;
  };
  items: Item[];
};

const ISSUE_TEXT: Record<string, { label: string; help: string }> = {
  billed_twice: { label: "Billed twice", help: "This member has more than one active PayPal subscription for the same plan." },
  not_on_site: { label: "Not on your site", help: "PayPal is charging this subscription, but your site has no record of it." },
  charging_but_site_ended: { label: "Charging after site ended it", help: "PayPal is still billing, but your site shows this membership as ended." },
  site_active_but_paypal_stopped: { label: "Site shows active, PayPal stopped", help: "Your site shows access, but PayPal is no longer billing." },
};

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—");

const statusTone = (s: string) =>
  s === "ACTIVE" ? "bg-green-600/15 text-green-500 border-green-600/30"
  : s === "SUSPENDED" ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
  : "bg-muted text-muted-foreground border-border";

const PayPalBillingTab = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-user-management", {
        body: { action: { type: "paypal_billing_report" } },
      });
      if (fnError || (data as any)?.error) throw new Error((data as any)?.error || "PayPal check failed");
      setReport(data as Report);
    } catch (e: any) {
      setError(e.message || "PayPal check failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const flagged = report?.items.filter((i) => i.issue) ?? [];
  const visible = report ? (showAll ? report.items : flagged) : [];

  return (
    <div className="space-y-4 pt-2">
      <Card className="bg-card/80">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">PayPal billing check</p>
              <p className="text-xs text-muted-foreground">
                Asks PayPal live who is really being charged and compares it with your site. Read-only — it never changes billing.
              </p>
              {report && <p className="mt-1 text-[11px] text-muted-foreground">Last checked {new Date(report.generated_at).toLocaleString()}</p>}
            </div>
          </div>
          <Button onClick={runCheck} disabled={loading} className="shrink-0">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {report ? "Check again" : "Check PayPal now"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Active on PayPal", value: report.summary.active_on_paypal, warn: false },
              { label: "Members billed twice", value: report.summary.billed_twice, warn: report.summary.billed_twice > 0 },
              { label: "Not on your site", value: report.summary.not_on_site, warn: report.summary.not_on_site > 0 },
              { label: "Status mismatches", value: report.summary.charging_but_site_ended + report.summary.site_active_but_paypal_stopped, warn: report.summary.charging_but_site_ended + report.summary.site_active_but_paypal_stopped > 0 },
            ].map((s) => (
              <Card key={s.label} className={s.warn ? "border-amber-500/50 bg-amber-500/5" : "bg-card/80"}>
                <CardContent className="p-3">
                  <p className={`text-2xl font-bold ${s.warn ? "text-amber-500" : "text-foreground"}`}>{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {!report.transactions_available && (
            <p className="text-[11px] text-muted-foreground">
              PayPal's transaction history wasn't available to this check, so subscriptions missing from your site may not all be listed.
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {showAll ? `All PayPal subscriptions (${report.items.length})` : `Needs attention (${flagged.length})`}
            </p>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show issues only" : "Show all"}
            </Button>
          </div>

          {visible.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/5 p-3 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />Everything matches — no billing problems found.
            </div>
          )}

          <div className="space-y-2">
            {visible.map((it) => (
              <Card key={it.paypal_id} className={it.issue ? "border-amber-500/40" : "bg-card/80"}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{it.member_name || it.member_email || "Unknown subscriber"}</p>
                      {it.member_email && <p className="truncate text-xs text-muted-foreground">{it.member_email}</p>}
                    </div>
                    <Badge variant="outline" className={statusTone(it.paypal_status)}>PayPal: {it.paypal_status.toLowerCase().replace("_", " ")}</Badge>
                  </div>

                  {it.issue && ISSUE_TEXT[it.issue] && (
                    <div className="rounded-md bg-amber-500/10 p-2 text-xs">
                      <p className="font-semibold text-amber-500">{ISSUE_TEXT[it.issue].label}</p>
                      <p className="text-muted-foreground">{ISSUE_TEXT[it.issue].help}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                    <div><span className="text-muted-foreground">PayPal plan</span><p className="text-foreground">{it.plan_name?.replace("MetsXMFanZone ", "") || "—"}{it.price ? ` · $${it.price}` : ""}</p></div>
                    <div><span className="text-muted-foreground">Next charge</span><p className="text-foreground">{fmtDate(it.next_billing)}</p></div>
                    <div><span className="text-muted-foreground">Last charge</span><p className="text-foreground">{fmtDate(it.last_payment)}</p></div>
                    <div><span className="text-muted-foreground">On your site</span><p className="text-foreground">{it.on_site ? `${it.site_plan} · ${it.site_status}` : "No record"}</p></div>
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">PayPal ID {it.paypal_id}{it.failed_payments ? ` · ${it.failed_payments} failed payment(s)` : ""}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PayPalBillingTab;
