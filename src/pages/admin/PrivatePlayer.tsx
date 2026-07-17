import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tv, Save, Eye, ExternalLink } from "lucide-react";

export const PRIVATE_PLAYER_SETTING_KEY = "admin_private_player";

export type PrivatePlayerConfig = {
  enabled: boolean;
  title: string;
  iframeUrl: string;
  rawEmbed: string; // optional raw <iframe ...> HTML
};

export const PRIVATE_PLAYER_DEFAULTS: PrivatePlayerConfig = {
  enabled: true,
  title: "Admin Private Player",
  iframeUrl: "",
  rawEmbed: "",
};

// Extract src="..." from a raw <iframe ...> HTML snippet.
export const extractIframeSrc = (raw: string): string | null => {
  if (!raw) return null;
  const match = raw.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return match?.[1] ?? null;
};

export default function PrivatePlayer() {
  const [cfg, setCfg] = useState<PrivatePlayerConfig>(PRIVATE_PLAYER_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", PRIVATE_PLAYER_SETTING_KEY)
        .maybeSingle();
      if (data?.setting_value) {
        setCfg({ ...PRIVATE_PLAYER_DEFAULTS, ...(data.setting_value as Partial<PrivatePlayerConfig>) });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      {
        setting_key: PRIVATE_PLAYER_SETTING_KEY,
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
    toast.success("Private player saved");
  };

  const set = <K extends keyof PrivatePlayerConfig>(k: K, v: PrivatePlayerConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const effectiveUrl = cfg.iframeUrl.trim() || extractIframeSrc(cfg.rawEmbed) || "";

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Tv className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Private Player</h1>
          <p className="text-sm text-muted-foreground">
            An iframe live stream player visible only to admins at{" "}
            <code className="text-primary">/private-player</code>.
          </p>
        </div>
      </div>

      <Card className="bg-card/90 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Enabled</span>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={cfg.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Iframe URL</Label>
            <Input
              placeholder="https://example.com/embed/your-stream"
              value={cfg.iframeUrl}
              onChange={(e) => set("iframeUrl", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Direct URL to embed. Leave blank if you're pasting the full &lt;iframe&gt; snippet below.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Or paste full &lt;iframe&gt; embed code</Label>
            <Textarea
              rows={5}
              placeholder='<iframe src="https://..." allowfullscreen></iframe>'
              value={cfg.rawEmbed}
              onChange={(e) => set("rawEmbed", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              We extract the <code>src</code> and render it in a safe sandboxed iframe.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => window.open("/private-player", "_blank")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Player
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/90 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {effectiveUrl ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-border">
              <iframe
                src={effectiveUrl}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                title={cfg.title}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add an iframe URL or embed code above to see the preview.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
