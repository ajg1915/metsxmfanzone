import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, Trash2, FileText, Copy, CheckCircle,
  XCircle, Clock, Eye, Search, CalendarClock, Code2, Share2,
} from "lucide-react";
import BlogShareDialog from "@/components/admin/BlogShareDialog";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  meta_description?: string;
  featured_image_url?: string;
  audio_url?: string;
  category: string;
  tags: string[];
  published: boolean;
  published_at?: string;
  scheduled_publish_at?: string;
  is_draft?: boolean;
  created_at: string;
  approval_status?: string;
  user_id?: string;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const SITE_URL = "https://metsxmfanzone.com";

export default function BlogManagement() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "scheduled" | "pending">("all");
  const [sharePost, setSharePost] = useState<BlogPost | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select(`*, profiles ( full_name, email )`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPosts((data as any) || []);
    } catch (e) {
      console.error("Error fetching posts:", e);
      toast({ title: "Error", description: "Failed to load blog posts", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter(p => {
      if (q && !(`${p.title} ${p.slug} ${p.category}`.toLowerCase().includes(q))) return false;
      if (filter === "published") return p.published && p.approval_status === "approved";
      if (filter === "draft") return !p.published && p.approval_status !== "pending";
      if (filter === "scheduled") return !!p.scheduled_publish_at && !p.published;
      if (filter === "pending") return p.approval_status === "pending";
      return true;
    });
  }, [posts, search, filter]);

  const counts = useMemo(() => ({
    all: posts.length,
    published: posts.filter(p => p.published && p.approval_status === "approved").length,
    draft: posts.filter(p => !p.published && p.approval_status !== "pending").length,
    scheduled: posts.filter(p => !!p.scheduled_publish_at && !p.published).length,
    pending: posts.filter(p => p.approval_status === "pending").length,
  }), [posts]);

  const handleApprove = async (post: BlogPost) => {
    try {
      const { error } = await supabase.from("blog_posts").update({
        approval_status: "approved", published: true, published_at: new Date().toISOString(),
      }).eq("id", post.id);
      if (error) throw error;

      try {
        await supabase.functions.invoke("send-push-notification", {
          body: { title: "📰 New Article on MetsXMFanZone!", body: post.title, url: `/blog/${post.slug}`, icon: "/logo-192.png", tag: `blog-${post.id}` },
        });
      } catch (e) { console.error("Push failed:", e); }

      toast({ title: "Approved & Published", description: "Article is live." });
      fetchPosts();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
    }
  };

  const handleReject = async (post: BlogPost) => {
    try {
      const { error } = await supabase.from("blog_posts").update({
        approval_status: "rejected", published: false,
      }).eq("id", post.id);
      if (error) throw error;
      toast({ title: "Rejected" });
      fetchPosts();
    } catch {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post permanently?")) return;
    try {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted" });
      fetchPosts();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleCopyLink = async (post: BlogPost) => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/blog/${post.slug}`);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Error", description: "Copy failed", variant: "destructive" });
    }
  };

  // ----- UI -----

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3 w-full max-w-full overflow-hidden px-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h1 className="text-sm sm:text-base font-bold">Blog Management</h1>
          <Badge variant="outline" className="text-[9px] h-5">{counts.all} total</Badge>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => navigate("/admin/blog/new")}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New Article
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, slug, category…" className="h-8 text-xs pl-6" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            ["all", "All", counts.all],
            ["published", "Live", counts.published],
            ["scheduled", "Scheduled", counts.scheduled],
            ["pending", "Pending", counts.pending],
            ["draft", "Drafts", counts.draft],
          ] as const).map(([k, label, n]) => (
            <Button key={k} variant={filter === k ? "default" : "outline"} size="sm"
              className="h-7 text-[10px] px-2"
              onClick={() => setFilter(k as any)}>
              {label} <span className="ml-1 opacity-60">{n}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {filteredPosts.length === 0 ? (
          <Card className="border-border/30">
            <CardContent className="py-6 text-center text-xs text-muted-foreground">
              No articles match your filters.
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map((post) => {
            const scheduledFuture = !!post.scheduled_publish_at && new Date(post.scheduled_publish_at).getTime() > Date.now();
            return (
              <Card key={post.id} className={`border-border/30 ${post.approval_status === "pending" ? "border-yellow-500/50" : ""}`}>
                <CardContent className="p-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <FileText className="w-3 h-3 flex-shrink-0 text-primary" />
                        <span className="text-xs font-medium truncate">{post.title}</span>
                        {post.approval_status === "pending" && (
                          <Badge variant="outline" className="h-4 text-[9px] border-yellow-500/50 text-yellow-400">
                            <Clock className="w-2 h-2 mr-0.5" /> Pending
                          </Badge>
                        )}
                        {scheduledFuture && (
                          <Badge variant="outline" className="h-4 text-[9px] border-blue-500/50 text-blue-400">
                            <CalendarClock className="w-2 h-2 mr-0.5" /> Scheduled
                          </Badge>
                        )}
                        {post.approval_status === "approved" && post.published && (
                          <Badge className="h-4 text-[9px] bg-green-500 text-white">Live</Badge>
                        )}
                        {!post.published && !scheduledFuture && post.approval_status !== "pending" && (
                          <Badge variant="outline" className="h-4 text-[9px]">Draft</Badge>
                        )}
                        {post.approval_status === "rejected" && (
                          <Badge variant="outline" className="h-4 text-[9px] border-red-500/50 text-red-400">Rejected</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        /{post.slug} · {post.category} · {new Date(post.created_at).toLocaleDateString()}
                        {post.profiles && <span> · by {post.profiles.full_name || post.profiles.email}</span>}
                        {scheduledFuture && <span className="text-blue-400"> · {new Date(post.scheduled_publish_at!).toLocaleString()}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 flex-wrap">
                      {post.published && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5" title="Open"
                            onClick={() => window.open(`/blog/${post.slug}`, "_blank")}>
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5" title="Open standalone HTML page"
                            onClick={() => window.open(`/blog-html/${post.slug}`, "_blank")}>
                            <Code2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 px-1.5" title="Share this article"
                        onClick={() => setSharePost(post)}>
                        <Share2 className="w-3 h-3 text-primary" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-1.5" title="Copy link"
                        onClick={() => handleCopyLink(post)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      {post.approval_status === "pending" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-green-500"
                            onClick={() => handleApprove(post)} title="Approve & publish">
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-red-500"
                            onClick={() => handleReject(post)} title="Reject">
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 px-1.5" title="Edit"
                        onClick={() => navigate(`/admin/blog/edit/${post.id}`)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-1.5 text-red-400"
                        onClick={() => handleDelete(post.id)} title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {(post.excerpt || post.content) && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {post.excerpt || post.content.replace(/<[^>]*>/g, " ").substring(0, 140)}…
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

    </div>
  );
}
