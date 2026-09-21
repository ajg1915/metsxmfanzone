import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFeedHealth } from "@/lib/feedHealth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type Check = {
  source: "primary" | "backup";
  url: string;
  status: "ok" | "empty" | "error";
  httpStatus: number | null;
  itemCount: number;
  durationMs: number;
  error: string | null;
} | null;

type Feed = {
  feedKey: string;
  label: string;
  overall: "healthy" | "degraded" | "down";
  primary: Check;
  backup: Check;
};

type Report = {
  checkedAt: string;
  overall: "healthy" | "degraded" | "down";
  problemCount: number;
  feeds: Feed[];
};

type HistoryEntry = {
  at: string;
  label: string;
  source: string;
  message: string;
};

const HISTORY_KEY = "admin_feed_health_history";
const AUTO_REFRESH_MS = 120000;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

const statusTone: Record<string, string> = {
  healthy: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  ok: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  degraded: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  empty: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  down: "text-destructive border-destructive/30 bg-destructive/10",
  error: "text-destructive border-destructive/30 bg-destructive/10",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "healthy" || status === "ok")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "down" || status === "error")
    return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertTriangle className="h-4 w-4 text-amber-400" />;
}

function SourceRow({ title, check }: { title: string; check: Check }) {
  if (!check) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <span className="text-xs text-muted-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">Not configured</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <StatusIcon status={check.status} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="truncate text-[10px] text-muted-foreground">{check.url}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{check.httpStatus ?? "no response"}</span>
        <span>·</span>
        <span>{check.itemCount} items</span>
        <span>·</span>
        <span>{check.durationMs}ms</span>
      </div>
      {check.error && (
        <p className="w-full text-[11px] text-destructive">{check.error}</p>
      )}
    </div>
  );
}

export default function FeedHealth() {
  const { toast } = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const lastAlertKey = useRef<string>("");

  const recordProblems = useCallback((data: Report) => {
    const entries: HistoryEntry[] = [];
    data.feeds.forEach((feed) => {
      [feed.primary, feed.backup].forEach((check) => {
        if (check && check.status !== "ok") {
          entries.push({
            at: data.checkedAt,
            label: feed.label,
            source: check.source,
            message: check.error ?? "Unknown error",
          });
        }
      });
    });
    if (!entries.length) return entries;
    setHistory((prev) => {
      const next = [...entries, ...prev].slice(0, 60);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage full — history is best effort */
      }
      return next;
    });
    return entries;
  }, []);

  const runCheck = useCallback(
    async (manual = false) => {
      setLoading(true);
      setFailed(null);
      try {
        const result = (await fetchFeedHealth()) as Report;
        setReport(result);
        const problems = recordProblems(result);

        const key = problems.map((p) => `${p.label}:${p.source}`).sort().join("|");
        if (problems.length && key !== lastAlertKey.current) {
          lastAlertKey.current = key;
          toast({
            title: `${problems.length} video source${problems.length > 1 ? "s" : ""} failing`,
            description: problems
              .slice(0, 3)
              .map((p) => `${p.label} (${p.source}): ${p.message}`)
              .join(" · "),
            variant: "destructive",
          });
        }
        if (!problems.length) {
          lastAlertKey.current = "";
          if (manual) toast({ title: "All feeds healthy", description: "Every source responded with content." });
        }
      } catch (err) {
        console.error("feed-health failed:", err);
        setFailed(err instanceof Error ? err.message : "Could not run the health check");
      } finally {
        setLoading(false);
      }
    },
    [recordProblems, toast]
  );

  useEffect(() => {
    runCheck();
    const timer = setInterval(() => runCheck(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [runCheck]);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-base font-bold text-foreground sm:text-lg">Feed Health</h1>
            <p className="text-[11px] text-muted-foreground">
              Primary and backup video, news and schedule sources · auto-checks every 2 minutes
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => runCheck(true)} disabled={loading} className="h-9 rounded-xl">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Check now
        </Button>
      </div>

      {failed && (
        <Card className="border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {failed}
        </Card>
      )}

      {report && (
        <Card
          className={`flex flex-wrap items-center gap-3 border p-3 sm:p-4 ${statusTone[report.overall]}`}
        >
          <ShieldAlert className="h-5 w-5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold capitalize">{report.overall}</p>
            <p className="text-[11px] opacity-80">
              {report.problemCount
                ? `${report.problemCount} feed${report.problemCount > 1 ? "s" : ""} needing attention`
                : "All sources responding with fresh content"}
              {" · checked "}
              {new Date(report.checkedAt).toLocaleTimeString()}
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {report?.feeds.map((feed) => (
          <Card key={feed.feedKey} className="space-y-2.5 border-border/60 bg-card/80 p-3 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{feed.label}</p>
              <Badge variant="outline" className={`text-[10px] capitalize ${statusTone[feed.overall]}`}>
                {feed.overall}
              </Badge>
            </div>
            <SourceRow title="Primary source" check={feed.primary} />
            <SourceRow title="Backup source" check={feed.backup} />
          </Card>
        ))}
        {!report && loading && (
          <Card className="p-6 text-center text-xs text-muted-foreground">Running health check…</Card>
        )}
      </div>

      <Card className="border-border/60 bg-card/80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Recent alerts</p>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={clearHistory}>
              Clear
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No source errors recorded on this device.</p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {history.map((h, i) => (
              <div
                key={`${h.at}-${h.label}-${h.source}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-[11px]"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-semibold text-foreground">{h.label}</span>
                <span className="text-muted-foreground">({h.source})</span>
                <span className="text-destructive">{h.message}</span>
                <span className="ml-auto text-muted-foreground">
                  {new Date(h.at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
