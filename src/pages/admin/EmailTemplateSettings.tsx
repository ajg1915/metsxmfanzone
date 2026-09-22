import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Palette, Image, Type, Save, RotateCcw, Upload } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminUI";

interface EmailSettings {
  logo_url: string;
  primary_color: string;
  card_bg_color: string;
  body_bg_color: string;
  heading_color: string;
  text_color: string;
  footer_text: string;
  button_border_radius: string;
  logo_width: number;
}

const DEFAULTS: EmailSettings = {
  logo_url: "https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/email-assets/metsxmfanzone-logo.png",
  primary_color: "#FF5910",
  card_bg_color: "#1a1a2e",
  body_bg_color: "#0a0a0a",
  heading_color: "#ffffff",
  text_color: "#d1d5db",
  footer_text: "© 2026 MetsXMFanZone — The Ultimate Mets Fan Community",
  button_border_radius: "10px",
  logo_width: 85,
};

const EmailTemplateSettings = () => {
  const [settings, setSettings] = useState<EmailSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("email_template_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (!error && data) {
      setSettings({
        logo_url: data.logo_url,
        primary_color: data.primary_color,
        card_bg_color: data.card_bg_color,
        body_bg_color: data.body_bg_color,
        heading_color: data.heading_color,
        text_color: data.text_color,
        footer_text: data.footer_text,
        button_border_radius: data.button_border_radius,
        logo_width: data.logo_width,
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("email_template_settings")
      .update(settings)
      .eq("id", 1);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } else {
      toast({ title: "Saved!", description: "Email template settings updated. Changes apply to all future emails." });
    }
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload a PNG or JPG image", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { publicUrl } = await uploadToR2(file, "email-assets");
      setSettings((prev) => ({ ...prev, logo_url: publicUrl }));
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Upload failed", variant: "destructive" });
      setUploading(false);
      return;
    }
    setUploading(false);
    toast({ title: "Logo uploaded!", description: "Don't forget to save your changes." });
  };

  const update = (key: keyof EmailSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Palette}
        title="Email Template Designer"
        description="Customize the look of all automated emails (signup, password reset, etc.)"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-4">
          {/* Logo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Image className="w-4 h-4" /> Logo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Logo URL</Label>
                <Input
                  value={settings.logo_url}
                  onChange={(e) => update("logo_url", e.target.value)}
                  placeholder="https://..."
                  className="text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Or upload a new logo (PNG recommended)</Label>
                <div className="mt-1">
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition text-xs">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Uploading..." : "Choose File"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>
              <div>
                <Label className="text-xs">Logo Width (px)</Label>
                <Input
                  type="number"
                  value={settings.logo_width}
                  onChange={(e) => update("logo_width", parseInt(e.target.value) || 85)}
                  min={40}
                  max={200}
                  className="w-24 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" /> Colors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {([
                ["primary_color", "Button / Accent Color"],
                ["body_bg_color", "Email Background"],
                ["card_bg_color", "Card Background"],
                ["heading_color", "Heading Text Color"],
                ["text_color", "Body Text Color"],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings[key]}
                    onChange={(e) => update(key, e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                  <div className="flex-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      value={settings[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="text-xs mt-0.5"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Type className="w-4 h-4" /> Footer & Shape
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Footer Text</Label>
                <Textarea
                  value={settings.footer_text}
                  onChange={(e) => update("footer_text", e.target.value)}
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Button Border Radius</Label>
                <Input
                  value={settings.button_border_radius}
                  onChange={(e) => update("button_border_radius", e.target.value)}
                  placeholder="10px"
                  className="w-24 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview — renders the real email HTML */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">Live Preview</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={loadPreview}
                disabled={previewLoading}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                {previewLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
            <div>
              <Label className="text-xs">Email to preview</Label>
              <select
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {templateOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {previewSubject && (
              <div className="rounded-md bg-muted/60 px-3 py-2 text-[11px] leading-relaxed">
                <div className="text-muted-foreground">From: noreply@metsxmfanzone.com</div>
                <div className="font-semibold">Subject: {previewSubject}</div>
              </div>
            )}
            {previewError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-4 text-xs text-destructive">
                {previewError}
              </div>
            ) : (
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox=""
                className="w-full h-[560px] rounded-lg border border-border bg-black"
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              This is the exact email members receive, using your current colors and logo.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
};

export default EmailTemplateSettings;
