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
    const fileName = `email-logo-${Date.now()}.${file.name.split(".").pop()}`;

    const { error: uploadError } = await supabase.storage
      .from("email-assets")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("email-assets").getPublicUrl(fileName);
    setSettings((prev) => ({ ...prev, logo_url: urlData.publicUrl }));
    setUploading(false);
    toast({ title: "Logo uploaded!", description: "Don't forget to save your changes." });
  };

  const update = (key: keyof EmailSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Template Designer</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customize the look of all automated emails (signup, password reset, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

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

        {/* Live Preview */}
        <Card className="h-fit sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-lg overflow-hidden"
              style={{ backgroundColor: settings.body_bg_color, padding: "24px 12px" }}
            >
              {/* Logo */}
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <img
                  src={settings.logo_url}
                  alt="Logo"
                  style={{
                    width: `${settings.logo_width}px`,
                    height: `${settings.logo_width}px`,
                    borderRadius: "12px",
                    objectFit: "contain",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>

              {/* Card */}
              <div
                style={{
                  backgroundColor: settings.card_bg_color,
                  borderRadius: "16px",
                  padding: "28px 24px",
                  border: `1px solid ${settings.primary_color}33`,
                }}
              >
                <h2
                  style={{
                    color: settings.heading_color,
                    fontSize: "20px",
                    fontWeight: "bold",
                    textAlign: "center",
                    margin: "0 0 16px",
                  }}
                >
                  Welcome to the Fan Zone! 🏟️
                </h2>
                <p
                  style={{
                    color: settings.text_color,
                    fontSize: "14px",
                    lineHeight: "1.6",
                    margin: "0 0 16px",
                  }}
                >
                  Hey there! Thanks for signing up for MetsXMFanZone. You're one step away
                  from joining the ultimate Mets fan community.
                </p>
                <div style={{ textAlign: "center", margin: "24px 0" }}>
                  <span
                    style={{
                      backgroundColor: settings.primary_color,
                      color: "#ffffff",
                      fontSize: "15px",
                      fontWeight: "bold",
                      borderRadius: settings.button_border_radius,
                      padding: "12px 28px",
                      display: "inline-block",
                    }}
                  >
                    Verify My Email
                  </span>
                </div>
              </div>

              {/* Footer */}
              <p
                style={{
                  color: "#4b5563",
                  fontSize: "11px",
                  textAlign: "center",
                  marginTop: "20px",
                }}
              >
                {settings.footer_text}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailTemplateSettings;
