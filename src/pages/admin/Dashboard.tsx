import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, Activity, Radio, HelpCircle, ArrowRight, UserCog, Eye, HeartPulse, Mail, Search, CreditCard, Globe, Sparkles, Settings, Video, Mic, ClipboardList, Loader2, RefreshCw, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function ManualFetchButton({ label, icon, functionName, successMessage, onCreditsExhausted }: { label: string; icon: React.ReactNode; functionName: string; successMessage: string; onCreditsExhausted?: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleFetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) {
        // Check if the error response contains credits exhausted info
        try {
          const errorBody = JSON.parse(error.message || "{}");
          if (errorBody.creditsExhausted || error.message?.includes("402") || error.message?.includes("credits")) {
            toast.error("AI Credits Exhausted", { 
              description: "Use manual entry in Predictions Management instead.",
              action: onCreditsExhausted ? { label: "Go to Manual Entry", onClick: onCreditsExhausted } : undefined
            });
            return;
          }
        } catch { /* not JSON, fall through */ }
        throw error;
      }
      toast.success(successMessage, { description: data?.message || JSON.stringify(data) });
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      if (msg.includes("credits") || msg.includes("402")) {
        toast.error("AI Credits Exhausted", { 
          description: "Use manual entry in Predictions Management instead.",
          action: onCreditsExhausted ? { label: "Go to Manual Entry", onClick: onCreditsExhausted } : undefined
        });
      } else {
        toast.error("Fetch failed", { description: msg });
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleFetch} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

function TestPushButton() {
  const [loading, setLoading] = useState(false);
  const handleSend = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-beams-notification", {
        body: {
          title: "MetsXMFanZone test alert",
          body: "If you can see this, notifications are working.",
          path: "/",
        },
      });
      if (error) throw error;
      if (!data?.sent) {
        toast.error("No alert sent", { description: data?.message || "No registered device found yet." });
        return;
      }
      toast.success("Test alert sent to the latest device");
    } catch (err: any) {
      toast.error("Test alert failed", { description: err?.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleSend} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
      Test Push
    </Button>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalBlogs: 0,
    activeStreams: 0,
    totalStreams: 0,
    totalStories: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setAdminUserId(user.id);

      const nowIso = new Date().toISOString();
      const [activeResult, streamsResult, blogsResult, storiesResult] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("user_id")
          .eq("status", "active")
          .or(`end_date.is.null,end_date.gt.${nowIso}`),
        supabase.from("live_streams").select("status"),
        supabase.from("blog_posts").select("*", { count: "exact", head: true }),
        supabase.from("stories").select("*", { count: "exact", head: true }),
      ]);

      const activeStreams = streamsResult.data?.filter(s => s.status === "live").length || 0;
      const totalStreams = streamsResult.data?.length || 0;
      const activeUsers = new Set((activeResult.data || []).map((s: any) => s.user_id)).size;

      setStats({
        activeUsers,
        totalBlogs: blogsResult.count || 0,
        activeStreams,
        totalStreams,
        totalStories: storiesResult.count || 0,
      });
    };


    fetchStats();
  }, []);

  const quickAccessItems = [
    {
      title: "Media Library",
      description: "Upload & manage all assets",
      icon: Eye,
      url: "/admin/media-library",
      stat: "Assets",
    },
    {
      title: "Highlights",
      description: "Manage video highlights",
      icon: Video,
      url: "/admin/video-gallery-management",
      stat: "Videos",
    },
    {
      title: "Podcasts",
      description: "Manage podcast episodes",
      icon: Mic,
      url: "/admin/podcasts",
      stat: "Episodes",
    },
    {
      title: "Live Streams & Health",
      description: "Manage streams & monitor health",
      icon: Radio,
      url: "/admin/live-streams",
      stat: `${stats.activeStreams} Live`,
    },
    {
      title: "Blog Management",
      description: "Create and manage blog posts",
      icon: FileText,
      url: "/admin/blog",
      stat: `${stats.totalBlogs} Posts`,
    },
    {
      title: "Members & Subscriptions",
      description: "Users, roles & subscription plans",
      icon: UserCog,
      url: "/admin/user-management",
      stat: `${stats.activeUsers} Active`,
    },
    {
      title: "Newsletter",
      description: "Send newsletters",
      icon: Mail,
      url: "/admin/newsletter",
      stat: "Send",
    },
    {
      title: "SEO",
      description: "Manage page SEO settings",
      icon: Globe,
      url: "/admin/seo",
      stat: "Optimize",
    },
  ];

  const filteredItems = quickAccessItems.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Welcome back. Here's what's happening today in the zone.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 px-4 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 transition-all">
                <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                How to Use
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#0a0f1e] border-white/10 text-slate-200">
              <DialogHeader>
                <DialogTitle className="text-white">Admin Portal Navigation Guide</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Learn how to navigate and use the admin portal effectively
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-white">Quick Access Cards</h3>
                  <p className="text-sm text-slate-400">
                    Use the quick access cards below to jump directly to the most commonly used features.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-white">Sidebar Navigation</h3>
                  <p className="text-sm text-slate-400">
                    The sidebar on the left organizes all admin features into categories: Overview, Streaming, Content, Podcasts, Community, Commerce, Members, Notifications, Email, and Settings.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            onClick={() => navigate("/admin/live-streams")}
            className="h-9 px-4 bg-[#FF5910] hover:brightness-110 rounded-lg text-xs font-bold text-white shadow-lg shadow-[#FF5910]/20 transition-all"
          >
            <Radio className="h-3.5 w-3.5 mr-1.5" /> Go Live
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Accounts", value: stats.activeUsers, icon: Users, accent: "text-[#FF5910]", sub: "Active memberships" },
          { label: "Blog Posts", value: stats.totalBlogs, icon: FileText, accent: "text-[#22c55e]", sub: "Published articles" },
          { label: "Stories", value: stats.totalStories, icon: Sparkles, accent: "text-[#FF5910]", sub: "Active stories" },
          { label: "Live Streams", value: `${stats.activeStreams}/${stats.totalStreams}`, icon: Radio, accent: "text-[#FF5910]", sub: stats.activeStreams > 0 ? "Live now" : "Standby" },
        ].map(({ label, value, icon: Icon, accent, sub }) => (
          <div
            key={label}
            className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden hover:border-[#FF5910]/30 transition-all group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Icon className={`w-12 h-12 ${accent}`} />
            </div>
            <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
            <p className={`text-[10px] mt-2 font-bold ${accent}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Manual Fetch Actions */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Manual Fetch</h3>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Daily Sync</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManualFetchButton label="Lineup Card" icon={<ClipboardList className="h-3.5 w-3.5" />} functionName="fetch-mets-lineup" successMessage="Lineup card fetched!" />
          <ManualFetchButton label="Highlights" icon={<Video className="h-3.5 w-3.5" />} functionName="fetch-mets-highlights" successMessage="Highlights fetched!" />
          <ManualFetchButton label="Schedule" icon={<RefreshCw className="h-3.5 w-3.5" />} functionName="fetch-mets-schedule" successMessage="Schedule fetched!" />
          <ManualFetchButton label="Predictions" icon={<Sparkles className="h-3.5 w-3.5" />} functionName="generate-daily-predictions" successMessage="Predictions generated!" onCreditsExhausted={() => navigate("/admin/predictions")} />
          <TestPushButton />
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-white">Quick Access</h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input
              placeholder="Search management areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-white/5 border-white/10 rounded-full text-slate-200 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-[#FF5910]/60"
            />
          </div>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {filteredItems.length > 0 ? filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                onClick={() => navigate(item.url)}
                className="text-left p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:border-[#FF5910]/40 hover:bg-white/[0.07] transition-all group relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FF5910]/10 border border-[#FF5910]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-[#FF5910]" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#FF5910] group-hover:translate-x-0.5 transition-all" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1 truncate">{item.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{item.description}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#FF5910]">{item.stat}</p>
              </button>
            );
          }) : (
            <div className="col-span-full text-center py-10 text-slate-500 text-sm">
              No management areas found for "{searchQuery}"
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
