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
    window.open("/", "_blank");
  };

  const set = <K extends keyof GateConfig>(k: K, v: GateConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Desktop Welcome Screen</h1>
          <p className="text-sm text-muted-foreground">
            Shown to all visitors who open the homepage on a PC (screens 1024px+).
          </p>
        </div>
      </div>

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
    </div>
  );
}
