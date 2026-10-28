import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Eye, EyeOff, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SeriesStream {
  id: string;
  title: string;
  status: string;
  scheduled_start: string;
  published: boolean;
}

const SERIES_GAP_MS = 60 * 60 * 60 * 1000;
const OPP = /(?:mets|nym)\s*(vs\.?|@|at)\s+(.+?)(?:\s+\d{1,2}\/\d{1,2}\/\d{2,4})?$/i;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

interface Run<T extends SeriesStream> {
  key: string;
  opponent: string;
  away: boolean;
  games: T[];
}

// The Mets games, grouped into series the same way the site's Game Series section does it.
export function groupMetsStreams<T extends SeriesStream>(streams: T[]): Run<T>[] {
  const parsed = streams
    .map((s) => {
      const m = s.title.replace(/\s+/g, " ").trim().match(OPP);
      return m ? { s, opponent: m[2].trim(), away: m[1] !== "vs" && m[1] !== "vs." } : null;
    })
    .filter((x): x is { s: T; opponent: string; away: boolean } => !!x)
    .sort((a, b) => new Date(a.s.scheduled_start || 8.64e15).getTime() - new Date(b.s.scheduled_start || 8.64e15).getTime());
  const runs: Run<T>[] = [];
  for (const { s, opponent, away } of parsed) {
    const last = runs[runs.length - 1];
    const prev = last?.games[last.games.length - 1];
    const gap = prev?.scheduled_start && s.scheduled_start ? new Date(s.scheduled_start).getTime() - new Date(prev.scheduled_start).getTime() : 0;
    if (last && last.opponent === opponent && last.away === away && gap <= SERIES_GAP_MS) last.games.push(s);
    else runs.push({ key: `${opponent}-${s.id}`, opponent, away, games: [s] });
  }
  return runs;
}

export default function MetsSeriesList<T extends SeriesStream>({
  streams,
  onEdit,
  onChanged,
}: {
  streams: T[];
  onEdit: (s: T) => void;
  onChanged: () => void;
}) {
  const runs = useMemo(() => groupMetsStreams(streams), [streams]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const setPublished = async (run: Run<T>, value: boolean) => {
    setBusy(run.key);
    const { error } = await supabase.from("live_streams").update({ published: value }).in("id", run.games.map((g) => g.id));
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success(`${run.games.length} games ${value ? "shown on the site" : "hidden"}`);
      onChanged();
    }
  };

  if (runs.length === 0) return <p className="text-sm text-muted-foreground">No Mets series yet. Load the schedule above to add them.</p>;

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const isOpen = !!open[run.key];
        const allPub = run.games.every((g) => g.published);
        const anyLive = run.games.some((g) => g.status === "live");
        return (
          <div key={run.key} className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [run.key]: !isOpen }))} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">Mets {run.away ? "@" : "vs"} {run.opponent}</span>
                  <span className="block text-xs text-muted-foreground">
                    {fmt(run.games[0].scheduled_start)}
                    {run.games.length > 1 ? ` – ${fmt(run.games[run.games.length - 1].scheduled_start)}` : ""} · {run.games.length} game{run.games.length > 1 ? "s" : ""}
                  </span>
                </span>
              </button>
              {anyLive && <Badge className="bg-red-600 text-white">LIVE</Badge>}
              <Badge variant={allPub ? "default" : "secondary"}>{allPub ? "On the site" : "Hidden"}</Badge>
              <Button size="sm" variant="outline" disabled={busy === run.key} onClick={() => setPublished(run, !allPub)}>
                {allPub ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
                {allPub ? "Hide series" : "Show series"}
              </Button>
            </div>
            {isOpen && (
              <div className="border-t border-border/60">
                {run.games.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate">{g.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">{g.status}{g.published ? "" : " · hidden"}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit game" onClick={() => onEdit(g)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
