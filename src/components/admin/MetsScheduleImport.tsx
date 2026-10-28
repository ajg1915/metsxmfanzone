import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchMetsRegularSeason, gameTitle, groupIntoSeries, type MetsSeries } from "@/lib/metsSeries";

const SEASON = 2027;
const MAIN_FEED_URL = "https://mystream.metsxmfanzone.com/hls/mystream.m3u8";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

// Pulls the Mets regular-season schedule from MLB, groups it into series and adds every game as a
// Mets game event (Mets & Networks). Games already added are skipped, so it is safe to run again.
export default function MetsScheduleImport({ onDone }: { onDone: () => void }) {
  const [series, setSeries] = useState<MetsSeries[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publish, setPublish] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setSeries(groupIntoSeries(await fetchMetsRegularSeason(SEASON)));
    } catch (e: any) {
      toast.error(e.message || "Couldn't load the schedule");
    }
    setLoading(false);
  };

  const total = series?.reduce((n, s) => n + s.games.length, 0) ?? 0;

  const add = async () => {
    if (!series) return;
    setSaving(true);
    try {
      const { data: existing, error: exErr } = await supabase
        .from("live_streams")
        .select("title, scheduled_start")
        .contains("assigned_pages", ["regular-season-games"]);
      if (exErr) throw exErr;
      const have = new Set((existing ?? []).map((r) => `${r.title}|${new Date(r.scheduled_start ?? 0).getTime()}`));

      const rows: any[] = [];
      for (const s of series) {
        s.games.forEach((g, i) => {
          const title = gameTitle(g);
          if (have.has(`${title}|${new Date(g.date).getTime()}`)) return;
          const start = new Date(g.date);
          rows.push({
            title,
            description: `${s.isHome ? "Home" : "Away"} series vs ${s.opponent} · Game ${i + 1} of ${s.games.length}${g.venue ? ` · ${g.venue}` : ""}`,
            stream_url: MAIN_FEED_URL,
            status: "scheduled",
            scheduled_start: start.toISOString(),
            scheduled_end: new Date(start.getTime() + 3.5 * 3600_000).toISOString(),
            assigned_pages: ["regular-season-games"],
            published: publish,
          });
        });
      }
      if (rows.length === 0) {
        toast.info("Every game is already added.");
      } else {
        for (let i = 0; i < rows.length; i += 50) {
          const { error } = await supabase.from("live_streams").insert(rows.slice(i, i + 50));
          if (error) throw error;
        }
        toast.success(`Added ${rows.length} games in ${series.length} series`);
        onDone();
      }
    } catch (e: any) {
      toast.error(e.message || "Couldn't add the games");
    }
    setSaving(false);
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" /> Mets {SEASON} schedule
          </p>
          <p className="text-xs text-muted-foreground">
            Pull every game from the schedule and add them as Mets game events, grouped by series.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {series ? "Reload schedule" : "Load schedule"}
        </Button>
      </div>

      {series && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            {total} games in {series.length} series
          </p>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-1.5 text-sm last:border-b-0">
                <span className="min-w-0 truncate">
                  Mets {s.isHome ? "vs" : "@"} {s.opponent}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmt(s.games[0].date)}
                  {s.games.length > 1 ? ` – ${fmt(s.games[s.games.length - 1].date)}` : ""} · {s.games.length} game{s.games.length > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="pub-series" checked={publish} onCheckedChange={setPublish} />
              <Label htmlFor="pub-series" className="text-sm">Show on the site right away</Label>
            </div>
            <Button size="sm" onClick={add} disabled={saving || total === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add {total} games
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
