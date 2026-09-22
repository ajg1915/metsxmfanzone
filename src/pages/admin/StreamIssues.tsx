import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, RefreshCw, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AdminEmpty,
  AdminFilterChips,
  AdminList,
  AdminListCard,
  AdminLoading,
  AdminPage,
  AdminPageHeader,
  AdminRow,
  AdminSearch,
  AdminToolbar,
} from "@/components/admin/AdminUI";

interface Issue {
  id: string;
  stream_id: string;
  issue_type: string;
  severity: string;
  description: string;
  resolved: boolean;
  created_at: string;
  live_streams?: { title?: string } | null;
}

const viewerTicket = (issue: Issue) => issue.description.startsWith("[Viewer ticket]");
const displayDescription = (value: string) => value.replace(/^\[Viewer ticket\]\n?/, "");

export default function StreamIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("open");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stream_health_reports")
      .select("*, live_streams(title)")
      .ilike("description", "[Viewer ticket]%")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error("Stream issues could not be loaded");
    else setIssues((data || []).filter(viewerTicket) as Issue[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-viewer-stream-issues")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_health_reports" }, load)
      .subscribe();
    const timer = window.setInterval(load, 60000);
    return () => { window.clearInterval(timer); supabase.removeChannel(channel); };
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (filter === "open" && issue.resolved) return false;
      if (filter === "resolved" && !issue.resolved) return false;
      return !query || `${issue.issue_type} ${issue.description} ${issue.live_streams?.title || ""}`.toLowerCase().includes(query);
    });
  }, [issues, search, filter]);

  const resolve = async (id: string) => {
    const { error } = await supabase
      .from("stream_health_reports")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Issue could not be resolved");
    else { toast.success("Issue resolved"); load(); }
  };

  if (loading && issues.length === 0) return <AdminLoading label="Loading stream issues…" />;

  const openCount = issues.filter((issue) => !issue.resolved).length;
  return (
    <AdminPage>
      <AdminPageHeader
        icon={AlertTriangle}
        title="Stream Issues"
        count={openCount}
        countLabel="open"
        description="Viewer tickets with automatic AI triage and playback diagnostics"
        actions={<Button variant="outline" size="sm" className="h-8 text-xs" onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button>}
      />
      <AdminToolbar>
        <AdminSearch value={search} onChange={setSearch} placeholder="Search issues…" />
        <AdminFilterChips
          active={filter}
          onChange={setFilter}
          filters={[
            { key: "open", label: "Open", count: openCount },
            { key: "resolved", label: "Resolved", count: issues.length - openCount },
            { key: "all", label: "All", count: issues.length },
          ]}
        />
      </AdminToolbar>
      {filtered.length === 0 ? <AdminEmpty message="No viewer stream issues match this view." /> : (
        <AdminList>
          {filtered.map((issue) => (
            <AdminListCard key={issue.id} highlight={!issue.resolved && (issue.severity === "high" || issue.severity === "critical")}>
              <AdminRow
                title={issue.live_streams?.title || "Live stream"}
                meta={`${new Date(issue.created_at).toLocaleString()} · ${issue.issue_type}`}
                badges={
                  <>
                    <Badge variant={issue.severity === "high" || issue.severity === "critical" ? "destructive" : "secondary"} className="h-4 text-[9px]">{issue.severity}</Badge>
                    <Badge variant="outline" className="h-4 text-[9px]">{issue.resolved ? "Resolved" : "Open"}</Badge>
                  </>
                }
                actions={!issue.resolved ? (
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => resolve(issue.id)}>
                    <CheckCircle className="mr-1 h-3 w-3" /> Resolve
                  </Button>
                ) : undefined}
                body={<pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">{displayDescription(issue.description)}</pre>}
              />
            </AdminListCard>
          ))}
        </AdminList>
      )}
    </AdminPage>
  );
}