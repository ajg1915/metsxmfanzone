import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, Activity, Radio, HelpCircle, ArrowRight, UserCog, Eye, HeartPulse, Mail, Search, CreditCard, Globe, Sparkles, Settings, Video, Mic, ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CreateBusinessAdForm from "@/components/CreateBusinessAdForm";
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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBlogs: 0,
    activeStreams: 0,
    totalStreams: 0,
    totalStories: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setAdminUserId(user.id);

      const [usersResult, streamsResult, blogsResult, storiesResult] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("live_streams").select("status"),
        supabase.from("blog_posts").select("*", { count: "exact", head: true }),
        supabase.from("stories").select("*", { count: "exact", head: true }),
      ]);

      const activeStreams = streamsResult.data?.filter(s => s.status === "live").length || 0;
      const totalStreams = streamsResult.data?.length || 0;

      setStats({
        totalUsers: usersResult.count || 0,
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
      stat: `${stats.totalUsers} Users`,
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
    <div className="w-full max-w-full px-1 sm:px-2 py-2 sm:py-3 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h2 className="text-base sm:text-lg font-bold">Dashboard</h2>
        <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              How to Use
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Admin Portal Navigation Guide</DialogTitle>
              <DialogDescription>
                Learn how to navigate and use the admin portal effectively
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Quick Access Cards</h3>
                <p className="text-sm text-muted-foreground">
                  Use the quick access cards below to jump directly to the most commonly used features: Blog Management, Live Streams, Lineup Cards, and User Management.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Sidebar Navigation</h3>
                <p className="text-sm text-muted-foreground">
                  The sidebar on the left organizes all admin features into categories:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <span className="font-medium">Media</span> - Manage blogs, videos, podcasts, and newsletters</li>
                  <li>• <span className="font-medium">Live Management</span> - Control live streams, stories, and events</li>
                  <li>• <span className="font-medium">User</span> - Manage users, posts, and subscriptions</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Common Tasks</h3>
                <div className="space-y-3">
                  <div className="border-l-2 border-primary pl-3">
                    <p className="font-medium text-sm">Creating a Live Stream</p>
                    <p className="text-xs text-muted-foreground">Navigate to Live Management → Live Streams → Add Live Stream. Enter stream URL, assign to pages, and set status.</p>
                  </div>
                  <div className="border-l-2 border-primary pl-3">
                    <p className="font-medium text-sm">Publishing a Blog Post</p>
                    <p className="text-xs text-muted-foreground">Go to Media → Blog Management → Create New Post. Write content, add featured image, and toggle Published switch.</p>
                  </div>
                  <div className="border-l-2 border-primary pl-3">
                    <p className="font-medium text-sm">Managing Users</p>
                    <p className="text-xs text-muted-foreground">Access User → User Management to view all users, change subscription plans, and manage accounts.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Need More Help?</h3>
                <p className="text-sm text-muted-foreground">
                  Each management page includes intuitive forms and buttons. Look for "Add New", "Create", or "+" buttons to create content, and "Edit" or pencil icons to modify existing items.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[10px] sm:text-xs font-medium truncate">Users</CardTitle>
            <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg sm:text-xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="min-w-0 cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/admin/stories")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[10px] sm:text-xs font-medium truncate">Stories</CardTitle>
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg sm:text-xl font-bold">{stats.totalStories}</div>
            <p className="text-[10px] text-muted-foreground">Total Stories</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/admin/settings")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[10px] sm:text-xs font-medium truncate">Settings</CardTitle>
            <Settings className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg sm:text-xl font-bold text-primary">Manage</div>
            <p className="text-[10px] text-muted-foreground">Site Settings</p>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[10px] sm:text-xs font-medium truncate">Status</CardTitle>
            <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg sm:text-xl font-bold text-green-500">Online</div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Fetch Actions */}
      <div className="mt-4 sm:mt-6">
        <h3 className="text-sm sm:text-base font-semibold mb-2">Manual Fetch</h3>
        <div className="flex flex-wrap gap-2">
          <ManualFetchButton
            label="Fetch Lineup Card"
            icon={<ClipboardList className="h-4 w-4" />}
            functionName="fetch-mets-lineup"
            successMessage="Lineup card fetched successfully!"
          />
          <ManualFetchButton
            label="Fetch Highlights"
            icon={<Video className="h-4 w-4" />}
            functionName="fetch-mets-highlights"
            successMessage="Highlights fetched successfully!"
          />
          <ManualFetchButton
            label="Fetch Schedule"
            icon={<RefreshCw className="h-4 w-4" />}
            functionName="fetch-mets-schedule"
            successMessage="Schedule fetched successfully!"
          />
          <ManualFetchButton
            label="Generate Predictions"
            icon={<Sparkles className="h-4 w-4" />}
            functionName="generate-daily-predictions"
            successMessage="Anthony's Predictions generated successfully!"
            onCreditsExhausted={() => navigate("/admin/predictions")}
          />
        </div>
      </div>

      <div className="mt-4 sm:mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
          <h3 className="text-sm sm:text-base font-semibold">Quick Access</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search management areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {filteredItems.length > 0 ? filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card 
                key={item.title}
                className="cursor-pointer hover:border-primary transition-colors min-w-0 min-h-[132px] sm:min-h-[148px]"
                onClick={() => navigate(item.url)}
              >
                <CardHeader className="pb-3 pt-5 px-5 sm:px-6">
                  <div className="flex items-center justify-between">
                    {/* Use explicit icon sizes (not just CSS) so mobile touch targets are reliably large */}
                    <Icon size={56} className="text-primary flex-shrink-0" />
                    <ArrowRight size={34} className="text-muted-foreground flex-shrink-0" />
                  </div>
                </CardHeader>
                <CardContent className="px-5 sm:px-6 pb-6">
                  <CardTitle className="text-base sm:text-lg mb-1.5 truncate">{item.title}</CardTitle>
                  <CardDescription className="text-sm sm:text-base mb-2.5 line-clamp-2">
                    {item.description}
                  </CardDescription>
                  <p className="text-sm sm:text-base font-semibold text-primary">{item.stat}</p>
                </CardContent>
              </Card>
            );
          }) : (
            <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
              No management areas found for "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {adminUserId && (
        <div className="mt-4 sm:mt-6">
          <CreateBusinessAdForm userId={adminUserId} />
        </div>
      )}
    </div>
  );
}
