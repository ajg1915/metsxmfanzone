import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchFeedHealth } from "@/lib/feedHealth";
import { useDraftsWaiting } from "@/hooks/useDraftsWaiting";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Mail,
  PenLine,
  Radio,
  Users,
  Video,
  Zap,
} from "lucide-react";

import { countManagedArticles } from "@/lib/articlesApi";
type FeedState = { overall: string; problemCount: number } | null;

/* --------------------------------- page ---------------------------------- */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const waiting = useDraftsWaiting("home");
  const [loadingStats, setLoadingStats] = useState(true);
  const [feed, setFeed] = useState<FeedState>(null);
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalBlogs: 0,
    activeStreams: 0,
    totalStreams: 0,
    totalStories: 0,
    totalPodcasts: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      const nowIso = new Date().toISOString();
      const [activeResult, streamsResult, blogsResult, storiesResult, podcastsResult] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("user_id")
          .eq("status", "active")
          .or(`end_date.is.null,end_date.gt.${nowIso}`),
        supabase.from("live_streams").select("status"),
        countManagedArticles().then((count) => ({ count }), () => ({ count: 0 })),
        supabase.from("stories").select("*", { count: "exact", head: true }),
        supabase.from("podcasts").select("*", { count: "exact", head: true }),
      ]);

      if (cancelled) return;
      setStats({
        activeUsers: new Set((activeResult.data || []).map((s: any) => s.user_id)).size,
        totalBlogs: blogsResult.count || 0,
        activeStreams: streamsResult.data?.filter((s) => s.status === "live").length || 0,
        totalStreams: streamsResult.data?.length || 0,
        totalStories: storiesResult.count || 0,
        totalPodcasts: podcastsResult.count || 0,
      });
      setLoadingStats(false);
    };

    const fetchFeed = async () => {
      try {
        const data = await fetchFeedHealth();
        if (!cancelled && data) setFeed({ overall: data.overall, problemCount: data.problemCount ?? 0 });
      } catch {
        if (!cancelled) setFeed({ overall: "unknown", problemCount: 0 });
      }
    };

    fetchStats();
    fetchFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  const isLive = stats.activeStreams > 0;

  const kpis = [
    {
      label: "Live now",
      value: isLive ? `${stats.activeStreams}` : "Off air",
      sub: `${stats.totalStreams} streams set up`,
      icon: Radio,
      tone: isLive ? "live" : "idle",
      url: "/admin/live-streams",
    },
    {
      label: "Paying members",
      value: stats.activeUsers,
      sub: "Active memberships",
      icon: Users,
      tone: "blue",
      url: "/admin/user-management",
    },
    {
      label: "Blog posts",
      value: stats.totalBlogs,
      sub: "Published articles",
      icon: FileText,
      tone: "blue",
      url: "/admin/drafts",
    },
    {
      label: "Feeds",
      value: feed ? (feed.overall === "healthy" ? "All good" : feed.overall === "unknown" ? "—" : `${feed.problemCount} issue${feed.problemCount === 1 ? "" : "s"}`) : "Checking…",
      sub: "Video, news & schedule sources",
      icon: Activity,
      tone: feed?.overall === "healthy" ? "ok" : feed?.overall === "unknown" || !feed ? "idle" : "warn",
      url: "/admin/live-streams?tab=health",
    },
  ];

  const toneRing: Record<string, string> = {
    live: "text-[#FF7A3D] bg-[#FF5910]/12 border-[#FF5910]/30",
    ok: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
    warn: "text-amber-400 bg-amber-400/10 border-amber-400/25",
    blue: "text-[#4F8FE8] bg-[#1E5FBF]/12 border-[#1E5FBF]/30",
    idle: "text-slate-400 bg-white/5 border-white/10",
  };


  const needs = [
    { label: "Drafts waiting for approval", count: waiting ?? 0, show: (waiting ?? 0) > 0, url: "/admin/drafts", icon: ClipboardCheck },
    { label: "Feed problems", count: feed?.problemCount ?? 0, show: (feed?.problemCount ?? 0) > 0, url: "/admin/live-streams?tab=health", icon: AlertTriangle },
  ].filter((n) => n.show);

  const quick = [
    { label: "Go live", icon: Radio, url: "/admin/live-streams", primary: true },
    { label: "Write article", icon: PenLine, url: "/admin/drafts/new" },
    { label: "Members", icon: Users, url: "/admin/user-management" },
    { label: "Daily Actions", icon: Zap, url: "/admin/daily-actions" },
    { label: "Newsletter", icon: Mail, url: "/admin/newsletter" },
    { label: "Highlights", icon: Video, url: "/admin/video-gallery-management" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-white">Welcome back</h1>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            isLive ? toneRing.live : toneRing.idle
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-[#FF5910]" : "bg-slate-500"}`} />
          {isLive ? "On air" : "Off air"}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, sub, icon: Icon, tone, url }) => (
          <button
            key={label}
            onClick={() => navigate(url)}
            className="adm-panel adm-panel-hover group min-w-0 p-4 text-left sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneRing[tone]}`}>
                <Icon className="h-4 w-4" />
              </span>
              <ArrowRight className="h-4 w-4 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-[#FF7A3D]" />
            </div>
            <p className="adm-chip text-slate-400">{label}</p>
            <p className="adm-display mt-1 truncate text-xl font-bold text-white sm:text-2xl">
              {loadingStats && typeof value === "number" ? "—" : value}
            </p>
            <p className="mt-1 truncate text-xs text-slate-400">{sub}</p>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <section className="adm-panel p-4 sm:p-5 lg:col-span-3">
          <h2 className="mb-2 text-white">Needs you today</h2>
          {needs.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">All clear. Nothing is waiting on you.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {needs.map(({ label, count, url, icon: Icon }) => (
                <li key={label}>
                  <button
                    onClick={() => navigate(url)}
                    className="flex min-h-[56px] w-full items-center gap-3 text-left text-[15px] font-semibold text-slate-100 hover:text-white"
                  >
                    <Icon className="h-5 w-5 flex-shrink-0 text-[#FF7A3D]" />
                    <span className="min-w-0 flex-1">{label}</span>
                    <span className="rounded-full bg-[#FF5910] px-2.5 py-0.5 text-xs font-extrabold text-[#0B1730]">{count}</span>
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-white">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
            {quick.map(({ label, icon: Icon, url, primary }) => (
              <button
                key={label}
                onClick={() => navigate(url)}
                className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-4 text-left text-[15px] font-semibold transition-colors ${
                  primary
                    ? "border-[#FF5910] bg-[#FF5910] text-white hover:brightness-110"
                    : "border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10"
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
