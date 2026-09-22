import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Save, RotateCcw, Eye, Smartphone, Home, LogIn, X } from "lucide-react";
import {
  GATE_DEFAULTS,
  WELCOME_GATE_SETTING_KEY,
  type GateConfig,
} from "@/components/DesktopWelcomeGate";
import logo from "@/assets/metsxmfanzone-logo.png";
import { AdminPage, AdminPageHeader, AdminLoading } from "@/components/admin/AdminUI";

export default function WelcomeScreenManagement() {
  const [cfg, setCfg] = useState<GateConfig>(GATE_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forcePreview, setForcePreview] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", WELCOME_GATE_SETTING_KEY)
        .maybeSingle();
      if (data?.setting_value) {
        setCfg({ ...GATE_DEFAULTS, ...(data.setting_value as Partial<GateConfig>) });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      {
        setting_key: WELCOME_GATE_SETTING_KEY,
        setting_value: cfg as any,
        setting_type: "general",
      },
      { onConflict: "setting_key" }
    );
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    toast.success("Welcome screen saved");
  };

  const reset = () => {
    setCfg(GATE_DEFAULTS);
    toast.info("Reset to defaults (click Save to apply)");
  };

  const preview = () => {
    sessionStorage.removeItem("desktop_welcome_gate_dismissed");
    window.open("/?preview_gate=1", "_blank");
  };


  const set = <K extends keyof GateConfig>(k: K, v: GateConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  if (loading) {
    return <AdminLoading />;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Monitor}
        title="Desktop Welcome Screen"
        description="Shown to all visitors who open the homepage on a PC (screens 1024px+)."
      />

      <Card className="bg-card/90 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Enabled</span>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={(v) => set("enabled", v)}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={cfg.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Subtitle</Label>
            <Textarea
              rows={3}
              value={cfg.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Note (small text box)</Label>
            <Textarea
              rows={2}
              value={cfg.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Leave empty to hide"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Left button label</Label>
              <Input
                value={cfg.primaryLabel}
                onChange={(e) => set("primaryLabel", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Left button URL</Label>
              <Input
                value={cfg.primaryUrl}
                onChange={(e) => set("primaryUrl", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Right button label</Label>
              <Input
                value={cfg.secondaryLabel}
                onChange={(e) => set("secondaryLabel", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Right button URL</Label>
              <Input
                value={cfg.secondaryUrl}
                onChange={(e) => set("secondaryUrl", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={preview}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/90 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Live Preview
            </span>
            <label className="flex items-center gap-2 text-xs font-normal text-muted-foreground cursor-pointer">
              <Switch checked={forcePreview} onCheckedChange={setForcePreview} />
              Always show
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {forcePreview ? (
            <div className="relative w-full rounded-xl border border-border bg-background/60 backdrop-blur p-4 overflow-hidden">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                Desktop view preview (updates as you type)
              </div>
              <div className="flex items-center justify-center bg-background/80 rounded-lg p-6 min-h-[480px]">
                <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/20 p-8">
                  <button
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Close"
                    type="button"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex justify-center mb-4">
                    <img
                      src={logo}
                      alt="MetsXMFanZone"
                      className="h-16 w-auto drop-shadow-[0_0_24px_hsl(var(--primary)/0.5)]"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                      <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-xl text-muted-foreground">+</div>
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                      <Monitor className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-center text-foreground mb-2">
                    {cfg.title}
                  </h2>
                  <p className="text-center text-muted-foreground mb-6 text-sm">
                    {cfg.subtitle}
                  </p>
                  {cfg.note && (
                    <div className="rounded-lg bg-muted/30 border border-border p-3 mb-6 text-center">
                      <p className="text-xs text-muted-foreground">{cfg.note}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button variant="outline" className="w-full" type="button">
                      <Home className="w-4 h-4 mr-2" />
                      {cfg.primaryLabel}
                    </Button>
                    <Button className="w-full bg-primary hover:bg-primary/90" type="button">
                      <LogIn className="w-4 h-4 mr-2" />
                      {cfg.secondaryLabel}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Toggle "Always show" to keep the live preview visible while editing.
            </p>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
