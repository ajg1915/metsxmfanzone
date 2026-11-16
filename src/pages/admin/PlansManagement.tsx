import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCESS_KEYS,
  DEFAULT_PLANS,
  PLANS_SETTING_KEY,
  PLAN_IDS,
  formatPrice,
  mergePlansConfig,
  usePlansConfig,
  type PlanDef,
  type PlanId,
  type PlansConfig,
} from "@/lib/plansConfig";

const lines = (list: string[]) => list.join("\n");
const toList = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

export default function PlansManagement() {
  const queryClient = useQueryClient();
  const { config: saved, loading } = usePlansConfig();
  const [plans, setPlans] = useState<PlansConfig>(DEFAULT_PLANS);
  const [priceText, setPriceText] = useState<Record<PlanId, string>>({ weekly: "", premium: "", annual: "" });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading || loaded) return;
    setPlans(saved);
    setPriceText({ weekly: String(saved.weekly.price), premium: String(saved.premium.price), annual: String(saved.annual.price) });
    setLoaded(true);
  }, [loading, loaded, saved]);

  const update = (id: PlanId, patch: Partial<PlanDef>) => setPlans((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const priceChanged = PLAN_IDS.filter((id) => Number(priceText[id]) !== saved[id].price);

  const save = async () => {
    for (const id of PLAN_IDS) {
      const n = Number(priceText[id]);
      if (!Number.isFinite(n) || n < 0.5 || n > 999.99) {
        toast.error(`${plans[id].name}: price must be between $0.50 and $999.99.`);
        return;
      }
    }
    const next = mergePlansConfig(
      Object.fromEntries(PLAN_IDS.map((id) => [id, { ...plans[id], price: Number(priceText[id]) }])),
    );
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      { setting_key: PLANS_SETTING_KEY, setting_value: next as never, setting_type: "general", is_public: true },
      { onConflict: "setting_key" },
    );
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["plans-config"] });
    setPlans(next);
    toast.success("Plans updated. The pricing page and stream access use this now.");
  };

  const reset = () => {
    setPlans(DEFAULT_PLANS);
    setPriceText({ weekly: String(DEFAULT_PLANS.weekly.price), premium: String(DEFAULT_PLANS.premium.price), annual: String(DEFAULT_PLANS.annual.price) });
    toast("Defaults loaded. Press Save to apply them.");
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading plans...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Plans and Access</h1>
        <p className="text-sm text-muted-foreground">
          Edit what each plan is called, what it costs, what the pricing page says, and which streams and features it can use.
        </p>
      </div>

      {priceChanged.length > 0 && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
          You changed the price of {priceChanged.map((id) => plans[id].name).join(", ")}. New signups pay the new price through a new PayPal
          billing plan. Members already subscribed keep the price they signed up at.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const p = plans[id];
          return (
            <div key={id} className="space-y-4 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <span className="text-sm text-muted-foreground">
                  {formatPrice(Number(priceText[id]) || 0)} {p.period}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label>Plan name</Label>
                <Input value={p.name} onChange={(e) => update(id, { name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Price in dollars ({p.period})</Label>
                <Input inputMode="decimal" value={priceText[id]} onChange={(e) => setPriceText((t) => ({ ...t, [id]: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Short description</Label>
                <Input value={p.description} onChange={(e) => update(id, { description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Billing note</Label>
                <Input value={p.billingNote} onChange={(e) => update(id, { billingNote: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Button text</Label>
                <Input value={p.cta} onChange={(e) => update(id, { cta: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show "Most popular" badge</Label>
                <Switch checked={p.popular} onCheckedChange={(v) => update(id, { popular: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>Included (one per line)</Label>
                <Textarea rows={7} value={lines(p.features)} onChange={(e) => update(id, { features: toList(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Not included (one per line, shown with an X)</Label>
                <Textarea rows={5} value={lines(p.notIncluded)} onChange={(e) => update(id, { notIncluded: toList(e.target.value) })} />
              </div>

              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium">What this plan can use</p>
                {ACCESS_KEYS.map(({ key, label, hint }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                    <Switch
                      checked={p.access[key]}
                      onCheckedChange={(v) => update(id, { access: { ...p.access, [key]: v } })}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        The text lists are only what the pricing page shows. The switches are what really lets a member in. HD quality, ad-free viewing and the
        number of devices are not controlled here yet.
      </p>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save plans
        </Button>
        <Button variant="outline" onClick={reset} disabled={saving}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset to defaults
        </Button>
      </div>
    </div>
  );
}
