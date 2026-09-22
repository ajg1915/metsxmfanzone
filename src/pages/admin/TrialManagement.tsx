import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Gift, Save } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminLoading } from "@/components/admin/AdminUI";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DEFAULT_FREE_TRIAL_CONFIG,
  FREE_TRIAL_SETTING_KEY,
  FreeTrialConfig,
  TrialWindow,
  todayET,
} from "@/hooks/useFreeTrial";

const newWindow = (): TrialWindow => ({
  id: crypto.randomUUID(),
  name: "Promo Window",
  startDate: todayET(),
  endDate: todayET(),
  audience: "all",
  grantPlan: "premium",
  grantDays: 7,
  active: true,
});

const TrialManagement = () => {
  const [config, setConfig] = useState<FreeTrialConfig>(DEFAULT_FREE_TRIAL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", FREE_TRIAL_SETTING_KEY)
        .maybeSingle();

      if (data?.setting_value) {
        setConfig({
          ...DEFAULT_FREE_TRIAL_CONFIG,
          ...(data.setting_value as unknown as FreeTrialConfig),
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("site_settings").upsert(
        {
          setting_key: FREE_TRIAL_SETTING_KEY,
          setting_value: config as unknown as never,
          is_public: true,
        },
        { onConflict: "setting_key" }
      );
      if (error) throw error;
      toast.success("Free access settings saved");
    } catch (e) {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateWindow = (id: string, patch: Partial<TrialWindow>) =>
    setConfig((c) => ({
      ...c,
      windows: c.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));

  if (loading) {
    return <AdminLoading label="Loading trial settings…" />;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Gift}
        title="Free Trials & Promo Days"
        count={config.windows.length}
        countLabel="promo windows"
        actions={
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={save} disabled={saving}>
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        }
      />

        <Card className="bg-card/90 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Standard Free Trial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Enable free trial</Label>
                <p className="text-xs text-muted-foreground">
                  Members can explore the whole site, streams stay preview-only.
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Trial length (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={config.trialDays}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, trialDays: Number(e.target.value) || 1 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stream preview (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={config.streamPreviewMinutes}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      streamPreviewMinutes: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/90 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Free Access for Visitors (Scheduled Games)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Allow free watching without an account</Label>
                <p className="text-xs text-muted-foreground">
                  Applies to scheduled game streams only. MetsXMFanZone Live always requires sign in.
                </p>
              </div>
              <Switch
                checked={config.guestPreviewEnabled !== false}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, guestPreviewEnabled: v }))}
              />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs">Free watching time (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={240}
                value={config.guestPreviewMinutes ?? 30}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    guestPreviewMinutes: Number(e.target.value) || 1,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                After this countdown, viewers must sign up and log in to keep watching.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/90 backdrop-blur">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Promotional Windows</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setConfig((c) => ({ ...c, windows: [...c.windows, newWindow()] }))}
            >
              <Plus className="w-4 h-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.windows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No promo windows yet. Add one to give away free paid memberships on specific dates.
              </p>
            )}

            {config.windows.map((w) => {
              const live = w.active && w.startDate <= todayET() && todayET() <= w.endDate;
              return (
                <div key={w.id} className="rounded-lg border border-border/60 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={w.name}
                      onChange={(e) => updateWindow(w.id, { name: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="Promo name"
                    />
                    {live && <Badge className="bg-primary shrink-0">Live</Badge>}
                    <Switch
                      checked={w.active}
                      onCheckedChange={(v) => updateWindow(w.id, { active: v })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          windows: c.windows.filter((x) => x.id !== w.id),
                        }))
                      }
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Start date</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={w.startDate}
                        onChange={(e) => updateWindow(w.id, { startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">End date</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={w.endDate}
                        onChange={(e) => updateWindow(w.id, { endDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Free days granted</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        className="h-8 text-xs"
                        value={w.grantDays}
                        onChange={(e) =>
                          updateWindow(w.id, { grantDays: Number(e.target.value) || 1 })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Membership granted</Label>
                      <Select
                        value={w.grantPlan}
                        onValueChange={(v) =>
                          updateWindow(w.id, { grantPlan: v as TrialWindow["grantPlan"] })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial (preview only)</SelectItem>
                          <SelectItem value="premium">Premium (full access)</SelectItem>
                          <SelectItem value="annual">Annual (full access)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Who qualifies</Label>
                      <Select
                        value={w.audience}
                        onValueChange={(v) =>
                          updateWindow(w.id, { audience: v as TrialWindow["audience"] })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Everyone</SelectItem>
                          <SelectItem value="new">New accounts only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
    </AdminPage>
  );
};

export default TrialManagement;
