import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Shirt } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { claimShirt, getShirtStatus, SHIRT_SIZES, type ShirtForm, type ShirtStatus } from "@/lib/shirtApi";

const EMPTY: ShirtForm = { name: "", size: "", address1: "", address2: "", city: "", state: "", zip: "", phone: "" };

export default function ClaimShirt() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromSignup = params.get("from") === "signup";
  const [status, setStatus] = useState<ShirtStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<ShirtForm>(EMPTY);
  const set = (k: keyof ShirtForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    const metaName = (user.user_metadata?.full_name || user.user_metadata?.name || "") as string;
    setForm((f) => ({ ...f, name: f.name || metaName }));
    getShirtStatus().then((st) => {
      // Right after a signup, members who do not qualify (weekly, free) just go on to the site.
      if (fromSignup && !st.eligible && !st.claimed) { navigate("/", { replace: true }); return; }
      setStatus(st);
    }).catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, [user, authLoading, navigate, fromSignup]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await claimShirt(form);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your claim");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Claim your free MetsXMFanZone shirt" description="Monthly and yearly members get a free MetsXMFanZone t-shirt." canonical="https://www.metsxmfanzone.com/claim-shirt" />
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto max-w-xl px-4 py-8 sm:py-12">
          <Card className="border-2 border-primary/40">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Shirt className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl text-primary">Your free MetsXMFanZone shirt</CardTitle>
              <CardDescription>Thanks for joining! Tell us your size and where to send it.</CardDescription>
            </CardHeader>
            <CardContent>
              {!status && !error && (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              )}

              {error && !done && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}

              {done && (
                <div className="space-y-3 py-4 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                  <p className="text-lg font-semibold">You're all set!</p>
                  <p className="text-sm text-muted-foreground">We got your shirt request and will ship it to the address you gave us.</p>
                  <Button onClick={() => navigate("/")} className="w-full">Back to the site</Button>
                </div>
              )}

              {status && !status.eligible && !done && (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">{status.reason}</p>
                  <Button onClick={() => navigate(status.claimed ? "/" : "/plans")} className="w-full">{status.claimed ? "Back to the site" : "See membership plans"}</Button>
                </div>
              )}

              {status?.eligible && !done && (
                <form onSubmit={submit} className="space-y-3">
                  <Field id="cs-name" label="Full name" value={form.name} onChange={(v) => set("name", v)} required autoComplete="name" />
                  <div className="space-y-1.5">
                    <Label>Shirt size</Label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {SHIRT_SIZES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set("size", s)}
                          aria-pressed={form.size === s}
                          className={`h-11 rounded-md border text-sm font-bold ${form.size === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field id="cs-a1" label="Street address" value={form.address1} onChange={(v) => set("address1", v)} required autoComplete="address-line1" />
                  <Field id="cs-a2" label="Apt, suite (optional)" value={form.address2} onChange={(v) => set("address2", v)} autoComplete="address-line2" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="cs-city" label="City" value={form.city} onChange={(v) => set("city", v)} required autoComplete="address-level2" />
                    <Field id="cs-state" label="State" value={form.state} onChange={(v) => set("state", v)} required autoComplete="address-level1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="cs-zip" label="ZIP code" value={form.zip} onChange={(v) => set("zip", v)} required autoComplete="postal-code" inputMode="numeric" />
                    <Field id="cs-phone" label="Phone (optional)" value={form.phone} onChange={(v) => set("phone", v)} autoComplete="tel" inputMode="tel" />
                  </div>
                  <Button type="submit" className="h-12 w-full text-base" disabled={busy || !form.size}>
                    {busy ? "Sending…" : "Send me my free shirt"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">One free shirt per member. We only use your address to ship it.</p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Field({ id, label, value, onChange, required, autoComplete, inputMode }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; autoComplete?: string; inputMode?: "numeric" | "tel" }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required} autoComplete={autoComplete} inputMode={inputMode} maxLength={120} className="h-11" />
    </div>
  );
}
