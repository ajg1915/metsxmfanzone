import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Gift, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";

type Status = "loading" | "form" | "submitting" | "claimed" | "opted_out" | "shipped" | "invalid" | "already";

export default function RewardClaim() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const initialAction = params.get("action");
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [tracking, setTracking] = useState<{ number?: string; carrier?: string }>({});
  const [form, setForm] = useState({
    shippingName: "", address1: "", address2: "", city: "",
    state: "", zip: "", country: "United States", shirtSize: "L", phone: "",
  });

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke("loyalty-reward-action", {
        body: { token, action: "lookup" },
      });
      if (error || !data?.ok) { setStatus("invalid"); return; }
      const r = data.reward;
      if (r.status === "claimed") setStatus("claimed");
      else if (r.status === "opted_out") setStatus("opted_out");
      else if (r.status === "shipped") {
        setTracking({ number: r.tracking, carrier: r.carrier });
        setStatus("shipped");
      } else if (r.status === "cancelled") setStatus("invalid");
      else setStatus("form");
    })();
  }, [token]);

  useEffect(() => {
    if (status === "form" && initialAction === "optout") void handleOptOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleOptOut = async () => {
    setStatus("submitting");
    const { data, error } = await supabase.functions.invoke("loyalty-reward-action", {
      body: { token, action: "optout" },
    });
    if (error || !data?.ok) {
      toast({ title: "Error", description: "Could not process opt-out.", variant: "destructive" });
      setStatus("form");
      return;
    }
    setStatus("opted_out");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    const { data, error } = await supabase.functions.invoke("loyalty-reward-action", {
      body: { token, action: "claim", ...form },
    });
    if (error || !data?.ok) {
      toast({ title: "Error", description: data?.error || "Could not submit claim.", variant: "destructive" });
      setStatus("form");
      return;
    }
    setStatus("claimed");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEOHead title="Claim Your Free T-Shirt | MetsXMFanZone" description="Claim your free MetsXMFanZone T-Shirt reward." />
      <Card className="w-full max-w-lg p-6 sm:p-8 bg-card/90 backdrop-blur border-border/40">
        {status === "loading" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center py-8">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h1 className="text-xl font-bold mb-2">Invalid or expired link</h1>
            <p className="text-sm text-muted-foreground">This reward link isn't valid. If you think this is a mistake, contact support.</p>
          </div>
        )}

        {status === "claimed" && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold mb-2">You're all set!</h1>
            <p className="text-sm text-muted-foreground">We received your shipping info. Your free T-shirt will go out soon — we'll email you tracking when it ships.</p>
          </div>
        )}

        {status === "shipped" && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold mb-2">Already shipped!</h1>
            {tracking.number && (
              <p className="text-sm text-muted-foreground">{tracking.carrier || "Tracking"}: <strong>{tracking.number}</strong></p>
            )}
          </div>
        )}

        {status === "opted_out" && (
          <div className="text-center py-8">
            <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h1 className="text-xl font-bold mb-2">No problem!</h1>
            <p className="text-sm text-muted-foreground">You've opted out of the free gift. Thanks for being part of MetsXMFanZone.</p>
          </div>
        )}

        {(status === "form" || status === "submitting") && (
          <>
            <div className="text-center mb-6">
              <Gift className="h-10 w-10 text-primary mx-auto mb-2" />
              <h1 className="text-2xl font-bold">Claim Your Free T-Shirt</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Thanks for being an active member for 60+ days! Fill in shipping info and we'll send a free MetsXMFanZone tee.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="shippingName">Full name</Label>
                <Input id="shippingName" required value={form.shippingName} onChange={(e) => setForm({ ...form, shippingName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="address1">Address line 1</Label>
                <Input id="address1" required value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="address2">Address line 2 (optional)</Label>
                <Input id="address2" value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="zip">ZIP</Label>
                  <Input id="zip" required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Shirt size</Label>
                  <Select value={form.shirtSize} onValueChange={(v) => setForm({ ...form, shirtSize: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["S", "M", "L", "XL", "XXL", "3XL"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-3">
                <Button type="submit" disabled={status === "submitting"} className="flex-1">
                  {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send me the T-Shirt
                </Button>
                <Button type="button" variant="outline" onClick={handleOptOut} disabled={status === "submitting"}>
                  No thanks, opt out
                </Button>
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
