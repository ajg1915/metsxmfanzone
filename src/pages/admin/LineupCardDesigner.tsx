import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, LayoutTemplate, Loader2, RefreshCw, Save } from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminUI";
import { LineupCardArt } from "@/components/lineup/LineupCardArt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_LINEUP_DESIGN,
  fetchLineupDesign,
  fetchMlbLineup,
  saveLineupDesign,
  todayET,
  type LineupDesign,
  type LineupGameInfo,
  type LineupPitcher,
  type LineupPlayerRow,
  type LineupTemplate,
} from "@/lib/lineupDesign";

const TEMPLATES: { key: LineupTemplate; label: string; hint: string }[] = [
  { key: "broadcast", label: "Broadcast", hint: "Blue gradient, orange accents" },
  { key: "classic", label: "Classic", hint: "Clean white card" },
  { key: "night", label: "Night game", hint: "Black with bright accents" },
];

const ACCENTS = ["#FF5910", "#FFB81C", "#2f9bff", "#ffffff", "#2ecc71"];
const BACKGROUNDS = ["#002D72", "#001F5B", "#0B3E75", "#111827", "#3b0a45"];

export default function LineupCardDesigner() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [design, setDesign] = useState<LineupDesign>(DEFAULT_LINEUP_DESIGN);
  const [game, setGame] = useState<LineupGameInfo | null>(null);
  const [lineup, setLineup] = useState<LineupPlayerRow[]>([]);
  const [pitcher, setPitcher] = useState<LineupPitcher | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string>("");
  const [useOverride, setUseOverride] = useState(false);

  const set = <K extends keyof LineupDesign>(k: K, v: LineupDesign[K]) => setDesign((d) => ({ ...d, [k]: v }));

  const loadFromMlb = async (quiet = false) => {
    setFetching(true);
    try {
      const r = await fetchMlbLineup();
      setGame(r.game);
      setLineup(r.lineup);
      setPitcher(r.pitcher);
      setNote(r.message || "");
      if (!quiet) toast({ title: r.lineup.length ? "Lineup loaded from MLB" : "No lineup yet", description: r.message });
    } catch (e) {
      toast({ title: "Could not load the lineup", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    (async () => {
      const saved = await fetchLineupDesign();
      setDesign(saved);
      const ov = saved.override && saved.override.date === todayET() ? saved.override : null;
      if (ov) {
        setUseOverride(true);
        setGame(ov.game);
        setLineup(ov.lineup);
        setPitcher(ov.pitcher);
        setLoading(false);
      } else {
        await loadFromMlb(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editRow = (i: number, patch: Partial<LineupPlayerRow>) => {
    setUseOverride(true);
    setLineup((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lineup.length) return;
    setUseOverride(true);
    setLineup((rows) => {
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((r, idx) => ({ ...r, position: idx + 1 }));
    });
  };

  const preview = useMemo(() => ({ design, game, lineup, pitcher }), [design, game, lineup, pitcher]);

  const save = async () => {
    setSaving(true);
    try {
      const toSave: LineupDesign = {
        ...design,
        override: useOverride && lineup.length ? { date: todayET(), game: game || { opponent: "TBD", isHome: true, dateLabel: "", timeLabel: "" }, lineup, pitcher } : null,
      };
      await saveLineupDesign(toSave);
      await qc.invalidateQueries({ queryKey: ["lineup-design"] });
      toast({ title: "Saved", description: toSave.enabled ? "The designed lineup card is live on the site." : "Saved. The card stays hidden on the site until you turn on Show on site." });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminPage>
        <AdminPageHeader icon={LayoutTemplate} title="Lineup Card" />
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        icon={LayoutTemplate}
        title="Lineup Card"
        description="Design the card fans see when the lineup comes out. Everything on the right is a live preview."
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button size="sm" variant="outline" className="h-9" onClick={() => { setUseOverride(false); loadFromMlb(); }} disabled={fetching}>
              {fetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Load from MLB
            </Button>
            <Button size="sm" className="h-9" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        }
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
        {/* Controls */}
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-semibold">Show on site</Label>
                <p className="text-xs text-muted-foreground">Puts this card at the top of Game Center and Picks. Off keeps the site as it is.</p>
              </div>
              <Switch checked={design.enabled} onCheckedChange={(v) => set("enabled", v)} />
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <p className="text-sm font-semibold">Style</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => set("template", t.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${design.template === t.key ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                >
                  <p className="text-sm font-bold">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.hint}</p>
                </button>
              ))}
            </div>

            <Swatches label="Accent color" value={design.accent} options={ACCENTS} onChange={(v) => set("accent", v)} />
            <Swatches label="Main color" value={design.background} options={BACKGROUNDS} onChange={(v) => set("background", v)} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" value={design.title} max={40} onChange={(v) => set("title", v)} />
              <Field label="Small line above title" value={design.subtitle} max={60} onChange={(v) => set("subtitle", v)} />
              <Field label="Footer" value={design.footer} max={60} onChange={(v) => set("footer", v)} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">Player photos</Label>
              <Switch checked={design.showPhotos} onCheckedChange={(v) => set("showPhotos", v)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">Starting pitcher</Label>
              <Switch checked={design.showPitcher} onCheckedChange={(v) => set("showPitcher", v)} />
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold">Today's lineup</p>
              <p className="text-xs text-muted-foreground">
                {useOverride ? "You edited this lineup, so the site will use your version today." : "Pulled live from MLB. Edit anything and your version is used today."}
                {note ? ` ${note}` : ""}
              </p>
            </div>
            {lineup.length === 0 ? (
              <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">No lineup yet. MLB usually posts it a couple of hours before first pitch. Tap Load from MLB to try again.</p>
            ) : (
              <ol className="space-y-2">
                {lineup.map((r, i) => (
                  <li key={i} className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-sm font-black text-primary">{r.position}</span>
                    <Input value={r.name} onChange={(e) => editRow(i, { name: e.target.value.slice(0, 60) })} className="h-9 min-w-0 flex-1" aria-label={`Batter ${r.position} name`} />
                    <Input value={r.fieldPosition} onChange={(e) => editRow(i, { fieldPosition: e.target.value.toUpperCase().slice(0, 3) })} className="h-9 w-14 shrink-0 text-center" aria-label={`Batter ${r.position} position`} />
                    <div className="flex shrink-0">
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-8" onClick={() => move(i, 1)} disabled={i === lineup.length - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {pitcher && (
              <div className="grid grid-cols-[1fr_5rem] gap-2 pt-1">
                <Input value={pitcher.name} onChange={(e) => { setUseOverride(true); setPitcher({ ...pitcher, name: e.target.value.slice(0, 60) }); }} className="h-9" aria-label="Starting pitcher" />
                <Input value={pitcher.hand} onChange={(e) => { setUseOverride(true); setPitcher({ ...pitcher, hand: e.target.value.toUpperCase().slice(0, 3) }); }} className="h-9 text-center" aria-label="Pitcher hand" />
              </div>
            )}
          </Card>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Saving the card as a picture for social posts is the next step. For now, take a screenshot of the preview.
          </p>
        </div>

        {/* Live preview */}
        <div className="order-1 min-w-0 lg:sticky lg:top-3 lg:order-2 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live preview</p>
          <LineupCardArt {...preview} />
        </div>
      </div>
    </AdminPage>
  );
}

function Field({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}

function Swatches({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`${label} ${c}`}
            className={`h-9 w-9 rounded-full border-2 ${value.toLowerCase() === c.toLowerCase() ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
            style={{ background: c }}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" aria-label={`Custom ${label}`} />
      </div>
    </div>
  );
}
