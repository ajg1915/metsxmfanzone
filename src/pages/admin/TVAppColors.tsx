import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, Moon, RotateCcw, Save, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DAY,
  DEFAULT_NIGHT,
  DEFAULT_TV_THEME,
  TV_COLOR_FIELDS,
  TV_THEME_KEY,
  currentTVLook,
  useTVThemeSettings,
  type TVPalette,
  type TVThemeMode,
  type TVThemeSettings,
} from "@/lib/tvTheme";

const MODES: { key: TVThemeMode; label: string; text: string; icon: typeof Sun }[] = [
  { key: "auto", label: "Automatic", text: "Day look in the daytime, night look at night", icon: Clock },
  { key: "day", label: "Always day", text: "The normal MetsXMFanZone colours", icon: Sun },
  { key: "night", label: "Always night", text: "Grey, blue and orange", icon: Moon },
];

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** A small picture of the TV home in these colours. */
function TVPreview({ p }: { p: TVPalette }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10" style={{ background: p.bg, color: p.text }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: p.card }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: p.accent }}>TV Mode</span>
        <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: p.surface }}>Home</span>
        <span className="text-[10px]" style={{ color: p.subtext }}>Live</span>
        <span className="text-[10px]" style={{ color: p.subtext }}>Podcast</span>
        <span className="ml-auto text-[10px] tabular-nums" style={{ color: p.subtext }}>8:30</span>
      </div>
      <div className="p-3">
        <div
          className="flex h-20 flex-col justify-end rounded-lg p-2"
          style={{ background: `linear-gradient(120deg, ${p.highlight} 0%, ${p.card} 70%, ${p.bg} 100%)` }}
        >
          <span className="w-fit rounded-full bg-[#e11d48] px-1.5 text-[8px] font-bold text-white">LIVE</span>
          <span className="text-sm font-bold">MetsXMFanZone TV</span>
          <span className="text-[10px]" style={{ color: p.subtext }}>Watch now</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: p.accent }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} /> Live now
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div
                className="aspect-video rounded-md"
                style={{ background: p.surface, outline: i === 0 ? "2px solid #fff" : undefined, outlineOffset: 2 }}
              />
              <div className="mt-1 h-1.5 w-3/4 rounded" style={{ background: p.text, opacity: 0.8 }} />
              <div className="mt-0.5 h-1 w-1/2 rounded" style={{ background: p.subtext, opacity: 0.7 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Admin › Settings › TV App Colours: Day / Night / Automatic, plus every colour of each look.
export default function TVAppColors() {
  const queryClient = useQueryClient();
  const { data: saved, isLoading } = useTVThemeSettings();
  const [s, setS] = useState<TVThemeSettings>(DEFAULT_TV_THEME);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saved) setS(saved);
  }, [saved]);

  const dirty = JSON.stringify(saved ?? DEFAULT_TV_THEME) !== JSON.stringify(s);
  const nowLook = currentTVLook(s);

  const setColor = (look: "day" | "night", key: keyof TVPalette, value: string) =>
    setS((prev) => ({ ...prev, [look]: { ...prev[look], [key]: value } }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      { setting_key: TV_THEME_KEY, setting_value: s as never, setting_type: "general", is_public: true },
      { onConflict: "setting_key" },
    );
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["tv-theme"] });
    toast.success("TV app colours saved. TVs pick them up within 10 minutes, or right away with Clear cache › Update MetsXMFanZone.");
  };

  const renderPalette = (look: "day" | "night") => {
    const p = s[look];
    const def = look === "day" ? DEFAULT_DAY : DEFAULT_NIGHT;
    const changed = JSON.stringify(p) !== JSON.stringify(def);
    const Icon = look === "day" ? Sun : Moon;
    return (
      <section className="adm-panel flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{look === "day" ? "Day look" : "Night look"}</h2>
            {nowLook === look && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">On now</span>
            )}
          </div>
          {changed && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setS((prev) => ({ ...prev, [look]: def }))}>
              <RotateCcw className="h-4 w-4" /> Default colours
            </Button>
          )}
        </div>
        <TVPreview p={p} />
        <div className="grid gap-2 sm:grid-cols-2">
          {TV_COLOR_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2">
              <Label htmlFor={`${look}-${f.key}`} className="text-sm">{f.label}</Label>
              <input
                id={`${look}-${f.key}`}
                type="color"
                value={p[f.key]}
                onChange={(e) => setColor(look, f.key, e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Settings</p>
          <h1 className="text-2xl font-bold text-foreground">TV app colours</h1>
          <p className="text-sm text-muted-foreground">
            Choose the colours of the MetsXMFanZone TV app, and when it switches from day to night.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty || saving} onClick={() => setS(saved ?? DEFAULT_TV_THEME)}>
            Undo changes
          </Button>
          <Button disabled={!dirty || saving} onClick={save} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="adm-panel space-y-4 p-5">
            <h2 className="text-lg font-semibold text-foreground">Day or night</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setS((prev) => ({ ...prev, mode: m.key }))}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                    s.mode === m.key ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50",
                  )}
                >
                  <m.icon className={cn("mt-0.5 h-5 w-5", s.mode === m.key ? "text-primary" : "text-muted-foreground")} />
                  <span>
                    <span className="block font-semibold text-foreground">{m.label}</span>
                    <span className="block text-sm text-muted-foreground">{m.text}</span>
                  </span>
                </button>
              ))}
            </div>
            {s.mode === "auto" && (
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Sun className="h-4 w-4" /> Day starts</span>
                  <input
                    type="time"
                    value={s.dayStart}
                    onChange={(e) => e.target.value && setS((prev) => ({ ...prev, dayStart: e.target.value }))}
                    className="h-10 rounded-md border border-border bg-background px-3 text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Moon className="h-4 w-4" /> Night starts</span>
                  <input
                    type="time"
                    value={s.nightStart}
                    onChange={(e) => e.target.value && setS((prev) => ({ ...prev, nightStart: e.target.value }))}
                    className="h-10 rounded-md border border-border bg-background px-3 text-foreground"
                  />
                </label>
                <p className="pb-2 text-sm text-muted-foreground">
                  Day {to12h(s.dayStart)} to {to12h(s.nightStart)}, night the rest, by each TV's own clock.
                </p>
              </div>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            {renderPalette("day")}
            {renderPalette("night")}
          </div>
        </>
      )}
    </div>
  );
}
