import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RefreshCw, Radio } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface SourceStatus {
  id: string;
  source_key: string;
  label: string;
  url: string;
  is_up: boolean;
  status_code: number | null;
  last_error: string | null;
  last_ok_at: string | null;
  last_down_at: string | null;
  consecutive_failures: number;
  checked_at: string;
}

export default function StreamSourceStatusPanel() {
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("stream_source_status")
      .select("*")
      .order("source_key", { ascending: true });
    setSources((data as SourceStatus[]) || []);
  }, []);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const { error } = await supabase.functions.invoke("monitor-stream-sources");
      if (error) throw error;
      await load();
      toast({ title: "Feed check complete", description: "Stream source status refreshed." });
    } catch (e) {
      toast({
        title: "Check failed",
        description: e instanceof Error ? e.message : "Could not reach the monitor.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  }, [load, toast]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("stream-source-status-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stream_source_status" },
        (payload) => {
          const row = payload.new as SourceStatus | undefined;
          if (row && row.is_up === false) {
            toast({
              title: "⚠️ Stream feed down",
              description: `${row.label}: ${row.last_error || "not responding"}`,
              variant: "destructive",
            });
          }
          load();
        },
      )
      .subscribe();
    const interval = window.setInterval(load, 60000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [load, toast]);

  const anyDown = sources.some((s) => !s.is_up);

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-md">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="w-4 h-4 text-primary" />
            Live Feed Health
          </CardTitle>
          <CardDescription className="text-xs">
            HLS feeds, checked automatically every 2 minutes.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={runCheck} disabled={checking}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
          Check now
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No checks recorded yet — press “Check now” to run the first probe.
          </p>
        ) : (
          sources.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-3 ${
                s.is_up ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40 bg-destructive/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {s.is_up ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <span className="text-sm font-semibold truncate">{s.label}</span>
                </div>
                <Badge variant={s.is_up ? "secondary" : "destructive"} className="text-[10px]">
                  {s.is_up ? "ONLINE" : "DOWN"}
                </Badge>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground break-all">{s.url}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span>Checked {formatDistanceToNow(new Date(s.checked_at), { addSuffix: true })}</span>
                {s.last_ok_at && (
                  <span>Last OK {formatDistanceToNow(new Date(s.last_ok_at), { addSuffix: true })}</span>
                )}
                {s.status_code != null && <span>HTTP {s.status_code}</span>}
                {!s.is_up && s.consecutive_failures > 0 && (
                  <span>{s.consecutive_failures} failed checks in a row</span>
                )}
              </div>
              {!s.is_up && s.last_error && (
                <p className="mt-1.5 text-[11px] font-medium text-destructive">{s.last_error}</p>
              )}
            </div>
          ))
        )}
        {anyDown && (
          <p className="text-[11px] text-muted-foreground">
            Update the stream m3u8 URL in Live Stream Management if a feed stays down.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
