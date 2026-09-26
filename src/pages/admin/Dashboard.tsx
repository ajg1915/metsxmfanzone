import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchFeedHealth } from "@/lib/feedHealth";
import ChatDashboardCard from "@/components/admin/ChatDashboardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  Mic,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

/* ---------------------------------- bits --------------------------------- */

function ManualFetchButton({
  label,
  icon,
  functionName,
  successMessage,
  onCreditsExhausted,
}: {
  label: string;
  icon: React.ReactNode;
  functionName: string;
  successMessage: string;
  onCreditsExhausted?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const handleFetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) {
        try {
          const errorBody = JSON.parse(error.message || "{}");
          if (errorBody.creditsExhausted || error.message?.includes("402") || error.message?.includes("credits")) {
            toast.error("AI Credits Exhausted", {
              description: "Use manual entry in Predictions Management instead.",
              action: onCreditsExhausted ? { label: "Go to Manual Entry", onClick: onCreditsExhausted } : undefined,
            });
            return;
          }
        } catch {
          /* not JSON, fall through */
        }
        throw error;
      }
      toast.success(successMessage, { description: data?.message || JSON.stringify(data) });
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      if (msg.includes("credits") || msg.includes("402")) {
        toast.error("AI Credits Exhausted", {
          description: "Use manual entry in Predictions Management instead.",
          action: onCreditsExhausted ? { label: "Go to Manual Entry", onClick: onCreditsExhausted } : undefined,
        });
      } else {
        toast.error("Fetch failed", { description: msg });
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={handleFetch}
      disabled={loading}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition-all hover:border-[#FF5910]/50 hover:bg-white/[0.08] disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#FF7A3D]" /> : icon}
      {label}
    </button>
  );
}

function TestPushButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("/");

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Add a title and a message first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-beams-notification", {
        body: {
          title: title.trim(),
          body: message.trim(),
          path: link.trim() || "/",
          interests: ["hello", "all-users"],
        },
      });
      if (error) throw error;
      if (!data?.sent) {
        toast.error("Notification not sent", { description: data?.error || "Please try again." });
        return;
      }
      toast.success("Push notification sent");
      setTitle("");
      setMessage("");
      setLink("/");
      setOpen(false);
    } catch (err: any) {
      toast.error("Push notification failed", { description: err?.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition-all hover:border-[#FF5910]/50 hover:bg-white/[0.08]">
          <Bell className="h-4 w-4" />
          Send push notification
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send push notification</DialogTitle>
          <DialogDescription>Goes to every device that turned on notifications.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title (e.g. Mets game starts soon!)" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            placeholder="Message"
            maxLength={500}
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Input placeholder="Link when tapped (e.g. /live)" maxLength={300} value={link} onChange={(e) => setLink(e.target.value)} />
          <Button onClick={handleSend} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            Send now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type FeedState = { overall: string; problemCount: number } | null;

/* --------------------------------- page ---------------------------------- */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
        supabase.from("blog_posts").select("*", { count: "exact", head: true }),
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
      url: "/admin/blog",
    },
    {
      label: "Feeds",
      value: feed ? (feed.overall === "healthy" ? "All good" : feed.overall === "unknown" ? "—" : `${feed.problemCount} issue${feed.problemCount === 1 ? "" : "s"}`) : "Checking…",
      sub: "Video, news & schedule sources",
      icon: Activity,
      tone: feed?.overall === "healthy" ? "ok" : feed?.overall === "unknown" || !feed ? "idle" : "warn",
      url: "/admin/feed-health",
    },
  ];

  const toneRing: Record<string, string> = {
    live: "text-[#FF7A3D] bg-[#FF5910]/12 border-[#FF5910]/30",
    ok: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
    warn: "text-amber-400 bg-amber-400/10 border-amber-400/25",
    blue: "text-[#4F8FE8] bg-[#1E5FBF]/12 border-[#1E5FBF]/30",
    idle: "text-slate-400 bg-white/5 border-white/10",
  };

  const jumpItems = [
    { title: "Live streams", description: "Schedule, go live, monitor", icon: Radio, url: "/admin/live-streams", tag: isLive ? "Live now" : "Standby" },
    { title: "Chat", description: "Live fan chats and left messages", icon: MessageCircle, url: "/admin/chat", tag: "Fans" },
    { title: "Stream tester", description: "Test M3U8 links before going live", icon: Link2, url: "/admin/stream-tester", tag: "Tool" },
    { title: "Blog", description: "Write and publish articles", icon: FileText, url: "/admin/blog", tag: `${stats.totalBlogs} posts` },
    { title: "Media library", description: "Images, video and audio", icon: ImageIcon, url: "/admin/media-library", tag: "Uploads" },
    { title: "Highlights", description: "Video gallery and clips", icon: Video, url: "/admin/video-gallery-management", tag: "Videos" },
    { title: "Podcasts", description: "Episodes and shows", icon: Mic, url: "/admin/podcasts", tag: `${stats.totalPodcasts} episodes` },
    { title: "Stories", description: "Short posts on the home page", icon: Sparkles, url: "/admin/stories", tag: `${stats.totalStories} live` },
    { title: "Members", description: "Accounts, roles and access", icon: Users, url: "/admin/user-management", tag: `${stats.activeUsers} active` },
    { title: "Subscriptions", description: "Plans, payments, renewals", icon: CreditCard, url: "/admin/subscriptions", tag: "Billing" },
    { title: "Newsletter", description: "Write and send emails", icon: Mail, url: "/admin/newsletter", tag: "Send" },
    { title: "Alerts & popups", description: "Push alerts and banners", icon: Megaphone, url: "/admin/popup-notifications", tag: "Notify" },
    { title: "Feed health", description: "Watch your content sources", icon: Activity, url: "/admin/feed-health", tag: feed?.overall === "healthy" ? "Healthy" : "Check" },
    { title: "Stream issues", description: "Review viewer playback tickets", icon: AlertTriangle, url: "/admin/stream-issues", tag: "Triage" },
    { title: "SEO", description: "Titles, previews and sitemap", icon: Globe, url: "/admin/seo", tag: "Optimize" },
  ];

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jumpItems;
    return jumpItems.filter(
      (i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    );
  }, [searchQuery, jumpItems]);

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Masthead */}
      <section className="adm-panel relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#FF5910]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-[-6rem] h-56 w-56 rounded-full bg-[#1E5FBF]/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 adm-chip ${
                  isLive ? toneRing.live : toneRing.idle
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-[#FF5910]" : "bg-slate-500"}`} />
                {isLive ? "On air" : "Off air"}
              </span>
              <span className="adm-chip text-slate-500">Control room</span>
            </div>
            <h1 className="text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-400">Everything running the zone, in one place.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
              <DialogTrigger asChild>
                <Button className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 hover:bg-white/10">
                  <HelpCircle className="mr-1.5 h-4 w-4" />
                  How to use
                </Button>
              </DialogTrigger>
              <DialogContent className="admin-shell max-h-[80vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0a1122] text-slate-200">
                <DialogHeader>
                  <DialogTitle className="text-white">Getting around the admin portal</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Three ways to reach any page.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm text-slate-400">
                  <p><span className="font-semibold text-white">Tiles below</span> — tap any card to jump straight to that area.</p>
                  <p><span className="font-semibold text-white">Search</span> — the box at the top (or ⌘K / Ctrl+K) finds any page by name.</p>
                  <p><span className="font-semibold text-white">Menu</span> — the left menu groups everything: Overview, Streaming, Content, Podcasts, Community, Commerce, Members, Notifications, Email and Settings. On a phone, the bar along the bottom holds your five most-used pages.</p>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              onClick={() => navigate("/admin/live-streams")}
              className="h-10 rounded-xl bg-[#FF5910] px-4 text-xs font-bold text-white shadow-lg shadow-[#FF5910]/25 hover:brightness-110"
            >
              <Radio className="mr-1.5 h-4 w-4" /> Go live
            </Button>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map(({ label, value, sub, icon: Icon, tone, url }) => (
          <button
            key={label}
            onClick={() => navigate(url)}
            className="adm-panel adm-panel-hover group p-4 text-left sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneRing[tone]}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <ArrowRight className="h-4 w-4 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-[#FF7A3D]" />
            </div>
            <p className="adm-chip text-slate-500">{label}</p>
            <p className="adm-display mt-1 truncate text-xl font-bold text-white sm:text-2xl">
              {loadingStats && typeof value === "number" ? "—" : value}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">{sub}</p>
          </button>
        ))}
      </section>

      {/* Chat */}
      <ChatDashboardCard />

      {/* Daily actions */}
      <section className="adm-panel p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-white">Daily actions</h2>
          <span className="adm-chip text-slate-500">Refresh content</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManualFetchButton label="Lineup card" icon={<ClipboardList className="h-4 w-4" />} functionName="fetch-mets-lineup" successMessage="Lineup card fetched!" />
          <ManualFetchButton label="Highlights" icon={<Video className="h-4 w-4" />} functionName="fetch-mets-highlights" successMessage="Highlights fetched!" />
          <ManualFetchButton label="Schedule" icon={<RefreshCw className="h-4 w-4" />} functionName="fetch-mets-schedule" successMessage="Schedule fetched!" />
          <ManualFetchButton
            label="Predictions"
            icon={<Sparkles className="h-4 w-4" />}
            functionName="generate-daily-predictions"
            successMessage="Predictions generated!"
            onCreditsExhausted={() => navigate("/admin/predictions")}
          />
          <TestPushButton />
        </div>
      </section>

      {/* Jump to */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-white">Jump to</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search these areas…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-xs text-slate-200 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-[#FF5910]/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredItems.length > 0 ? (
            filteredItems.map(({ title, description, icon: Icon, url, tag }) => (
              <button
                key={title}
                onClick={() => navigate(url)}
                className="adm-panel adm-panel-hover group flex items-center gap-3.5 p-4 text-left"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#FF5910]/25 bg-[#FF5910]/10 text-[#FF7A3D] transition-transform group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="adm-display block truncate text-sm font-bold text-white">{title}</span>
                  <span className="block truncate text-[11px] text-slate-400">{description}</span>
                  <span className="adm-chip mt-1 block text-[#4F8FE8]">{tag}</span>
                </span>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-[#FF7A3D]" />
              </button>
            ))
          ) : (
            <div className="col-span-full py-10 text-center text-sm text-slate-500">
              Nothing matches “{searchQuery}”.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
