import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import {
  FRONT_PAGE_SECTIONS,
  FRONT_PAGE_SETTING_KEY,
  sectionStyle,
  useFrontPageStyles,
  type FrontPageSection,
  type FrontPageStyles,
  type SectionStyle,
} from "@/lib/frontPageSections";

// Admin › Settings › Front Page: colour and background image for each section of the signed-out
// front page. Images upload to Cloudflare R2.
export default function FrontPageSections() {
  const queryClient = useQueryClient();
  const { data: saved, isLoading } = useFrontPageStyles();
  const [styles, setStyles] = useState<FrontPageStyles>({});
  const [uploading, setUploading] = useState<FrontPageSection | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<FrontPageSection | null>(null);

  useEffect(() => {
    if (saved) setStyles(saved);
  }, [saved]);

  const dirty = JSON.stringify(saved ?? {}) !== JSON.stringify(styles);

  const update = (key: FrontPageSection, patch: Partial<SectionStyle>) =>
    setStyles((prev) => {
      const next = { ...(prev[key] ?? {}), ...patch };
      (Object.keys(next) as (keyof SectionStyle)[]).forEach((k) => next[k] === undefined && delete next[k]);
      return { ...prev, [key]: next };
    });

  const pickImage = (key: FrontPageSection) => {
    uploadFor.current = key;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const key = uploadFor.current;
    if (!file || !key) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setUploading(key);
    try {
      const { publicUrl } = await uploadToR2(file, "front-page");
      update(key, { image: publicUrl, dim: styles[key]?.dim ?? 65 });
      toast.success("Image uploaded. Press Save to put it live.");
    } catch (err) {
      toast.error("Upload failed: " + (err instanceof Error ? err.message : "try again"));
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      { setting_key: FRONT_PAGE_SETTING_KEY, setting_value: styles as never, setting_type: "general", is_public: true },
      { onConflict: "setting_key" },
    );
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["front-page-sections"] });
    toast.success("Front page updated.");
  };

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Settings</p>
          <h1 className="text-2xl font-bold text-foreground">Front page sections</h1>
          <p className="text-sm text-muted-foreground">
            Set a colour and/or a background image for each section of the page visitors see before they sign in.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty || saving} onClick={() => setStyles(saved ?? {})}>
            Undo changes
          </Button>
          <Button disabled={!dirty || saving} onClick={save} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FRONT_PAGE_SECTIONS.map((sec) => {
            const st = styles[sec.key] ?? {};
            return (
              <div key={sec.key} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/70 p-4">
                <div
                  className="flex aspect-video items-end rounded-lg border border-white/10 p-3"
                  style={sectionStyle(st, { background: sec.defaultColor })}
                >
                  <span className="text-sm font-bold text-white drop-shadow">{sec.label}</span>
                </div>

                {"imageOnly" in sec ? (
                  <p className="text-xs text-muted-foreground">Shown on the little TV screen and the members preview. Leave empty to use the channel's own picture.</p>
                ) : (
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`color-${sec.key}`} className="text-sm">Colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`color-${sec.key}`}
                      type="color"
                      value={st.color ?? sec.defaultColor}
                      onChange={(e) => update(sec.key, { color: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                    />
                    {st.color && (
                      <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Use the default colour" onClick={() => update(sec.key, { color: undefined })}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2" disabled={uploading === sec.key} onClick={() => pickImage(sec.key)}>
                    {uploading === sec.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {st.image ? "Change image" : "Add image"}
                  </Button>
                  {st.image && (
                    <Button variant="ghost" size="icon" aria-label="Remove image" onClick={() => update(sec.key, { image: undefined, dim: undefined })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {st.image && !("imageOnly" in sec) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Darkness over the image</span>
                      <span>{st.dim ?? 65}%</span>
                    </div>
                    <Slider min={0} max={90} step={5} value={[st.dim ?? 65]} onValueChange={([v]) => update(sec.key, { dim: v })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Best image size: 1920 × 1080 or wider, under 1 MB. Changes show on the front page after you press Save.</p>
    </div>
  );
}
