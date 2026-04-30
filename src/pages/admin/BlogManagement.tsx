import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, Trash2, FileText, Music, Copy, CheckCircle,
  XCircle, Clock, Loader2, Eye, Search, CalendarClock,
} from "lucide-react";
import { z } from "zod";
import { validateFile, generateSafeFilename } from "@/utils/fileValidation";
import RichTextEditor from "@/components/admin/RichTextEditor";

const blogPostSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  slug: z.string().trim().min(1, "Slug is required").max(250).regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only"),
  content: z.string().trim().min(10, "Content must be at least 10 characters").max(100000),
  excerpt: z.string().trim().max(500).optional(),
  meta_description: z.string().trim().max(160, "Meta description should be ≤160 chars").optional(),
  featured_image_url: z.string().trim().max(2000).optional(),
  category: z.string().trim().min(1, "Category is required").max(100),
  tags: z.string().trim().max(300).optional(),
  published: z.boolean(),
  scheduled_publish_at: z.string().optional(),
});

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

const ADMIN_DRAFT_KEY = "admin-blog-draft-v2";
const SITE_URL = "https://metsxmfanzone.com";

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 250);

export default function BlogManagement() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "scheduled" | "pending">("all");
  const [autoSlug, setAutoSlug] = useState(true);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const formInitialized = useRef(false);
  const editorImageInputRef = useRef<HTMLInputElement>(null);

  const defaultFormData = {
    title: "", slug: "", content: "", excerpt: "", meta_description: "",
    featured_image_url: "", audio_url: "", category: "General", tags: "",
    published: false, scheduled_publish_at: "",
  };
  const [formData, setFormData] = useState(defaultFormData);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Auto-slug from title
  useEffect(() => {
    if (autoSlug && !editingPost && formData.title) {
      setFormData(f => ({ ...f, slug: slugify(formData.title) }));
    }
  }, [formData.title, autoSlug, editingPost]);

  // Auto-save draft
  const saveDraft = useCallback(() => {
    if (editingPost || !formInitialized.current) return;
    if (!formData.title && !formData.content) return;
    try {
      localStorage.setItem(ADMIN_DRAFT_KEY, JSON.stringify({ ...formData, savedAt: Date.now() }));
      setSavedAt(Date.now());
    } catch {}
  }, [formData, editingPost]);

  useEffect(() => {
    if (editingPost) return;
    const interval = setInterval(saveDraft, 4000);
    return () => clearInterval(interval);
  }, [saveDraft, editingPost]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(ADMIN_DRAFT_KEY); } catch {}
    setSavedAt(null);
  }, []);

  // Restore draft once
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (Date.now() - draft.savedAt < 7 * 24 * 60 * 60 * 1000) {
          setFormData({ ...defaultFormData, ...draft });
          setDraftRestored(true);
        }
      }
    } catch {}
    formInitialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
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
  };

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
    } catch (e) {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validation = blogPostSchema.safeParse(formData);
    if (!validation.success) {
      const first = validation.error.errors[0];
      toast({ title: "Validation Error", description: first.message, variant: "destructive" });
      return;
    }

    const tagsArray = formData.tags.split(",").map(t => t.trim()).filter(Boolean);
    if (tagsArray.some(t => t.length > 50)) {
      toast({ title: "Validation Error", description: "Each tag must be ≤50 chars", variant: "destructive" });
      return;
    }

    const scheduled = formData.scheduled_publish_at ? new Date(formData.scheduled_publish_at).toISOString() : null;
    const isScheduledFuture = !!scheduled && new Date(scheduled).getTime() > Date.now();

    const postData: any = {
      title: formData.title.trim(),
      slug: slugify(formData.slug),
      content: formData.content,
      excerpt: formData.excerpt || null,
      meta_description: formData.meta_description || null,
      featured_image_url: formData.featured_image_url || null,
      audio_url: formData.audio_url || null,
      category: formData.category,
      tags: tagsArray,
      user_id: user.id,
      approval_status: "approved",
      scheduled_publish_at: scheduled,
      // If scheduled in the future, keep it unpublished. Otherwise honor switch.
      published: isScheduledFuture ? false : formData.published,
      published_at: (isScheduledFuture ? null : (formData.published ? new Date().toISOString() : null)),
      is_draft: !formData.published && !isScheduledFuture,
    };

    try {
      if (editingPost) {
        const { error } = await supabase.from("blog_posts").update(postData).eq("id", editingPost.id);
        if (error) throw error;
        toast({ title: "Updated", description: isScheduledFuture ? "Scheduled for later." : "Saved." });
      } else {
        const { error } = await supabase.from("blog_posts").insert([postData]);
        if (error) throw error;
        toast({ title: "Created", description: isScheduledFuture ? "Scheduled for later." : "Saved." });
      }
      clearDraft();
      setIsDialogOpen(false);
      resetForm();
      fetchPosts();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.includes("duplicate") ? "Slug already exists. Try a different one." : (e?.message || "Failed to save");
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setAutoSlug(false);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || "",
      meta_description: post.meta_description || "",
      featured_image_url: post.featured_image_url || "",
      audio_url: post.audio_url || "",
      category: post.category,
      tags: post.tags?.join(", ") || "",
      published: post.published,
      scheduled_publish_at: post.scheduled_publish_at ? new Date(post.scheduled_publish_at).toISOString().slice(0, 16) : "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post permanently?")) return;
    try {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted" });
      fetchPosts();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };



  const uploadToBucket = async (file: File, bucket: string, folder: string) => {
    const fileName = generateSafeFilename(file.name);
    const filePath = `${folder}/${fileName}`;
    const { error } = await supabase.storage.from(bucket).upload(filePath, file);
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
  };

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const validation = await validateFile(file, 'image', 5);
    if (!validation.valid) { toast({ title: "Error", description: validation.error, variant: "destructive" }); return; }
    setUploadingFeatured(true);
    try {
      const url = await uploadToBucket(file, "content_uploads", "blog-images");
      setFormData(f => ({ ...f, featured_image_url: url }));
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setUploadingFeatured(false); e.target.value = ""; }
  };

  const handleEditorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const validation = await validateFile(file, 'image', 5);
    if (!validation.valid) { toast({ title: "Error", description: validation.error, variant: "destructive" }); return; }
    setUploadingImage(true);
    try {
      const url = await uploadToBucket(file, "content_uploads", "blog-images");
      // Append image tag to content (Tiptap re-syncs via the value prop)
      setFormData(f => ({ ...f, content: f.content + `<p><img src="${url}" alt="" /></p>` }));
      toast({ title: "Inserted into article" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setUploadingImage(false); e.target.value = ""; }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const validation = await validateFile(file, 'audio', 50);
    if (!validation.valid) { toast({ title: "Error", description: validation.error, variant: "destructive" }); return; }
    setUploadingAudio(true);
    try {
      const url = await uploadToBucket(file, "podcasts", "blog-audio");
      setFormData(f => ({ ...f, audio_url: url }));
      toast({ title: "Audio uploaded" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setUploadingAudio(false); e.target.value = ""; }
  };

  const resetForm = () => {
    setEditingPost(null);
    setFormData(defaultFormData);
    setDraftRestored(false);
    setAutoSlug(true);
    clearDraft();
  };

  const handleCopyLink = async (post: BlogPost) => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/blog/${post.slug}`);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Error", description: "Copy failed", variant: "destructive" });
    }
  };

  const wordCount = useMemo(() => {
    const txt = formData.content.replace(/<[^>]*>/g, " ").trim();
    if (!txt) return 0;
    return txt.split(/\s+/).length;
  }, [formData.content]);

  const slugConflict = useMemo(() => {
    if (!formData.slug) return false;
    return posts.some(p => p.slug === formData.slug && p.id !== editingPost?.id);
  }, [formData.slug, posts, editingPost]);

  const isScheduledFuture = !!formData.scheduled_publish_at &&
    new Date(formData.scheduled_publish_at).getTime() > Date.now();

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
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[96vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-3 sm:p-5">
            <DialogHeader>
              <DialogTitle className="text-base">
                {editingPost ? "Edit Article" : "New Article"}
              </DialogTitle>
              <DialogDescription className="text-[11px] flex items-center gap-2 flex-wrap">
                {savedAt && !editingPost && (
                  <span className="text-green-400">✓ Auto-saved {new Date(savedAt).toLocaleTimeString()}</span>
                )}
                {draftRestored && !editingPost && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px]"
                    onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    Discard restored draft
                  </Button>
                )}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Tabs defaultValue="write" className="w-full">
                <TabsList className="grid grid-cols-3 h-8">
                  <TabsTrigger value="write" className="text-xs">✍️ Write</TabsTrigger>
                  <TabsTrigger value="seo" className="text-xs">🔍 SEO</TabsTrigger>
                  <TabsTrigger value="publish" className="text-xs">🚀 Publish</TabsTrigger>
                </TabsList>

                {/* WRITE TAB */}
                <TabsContent value="write" className="space-y-2 mt-3">
                  <div>
                    <Label className="text-[11px]">Title</Label>
                    <Input value={formData.title}
                      onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                      placeholder="Your article title…" className="h-9 text-sm" required />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Category</Label>
                      <Input value={formData.category}
                        onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                        className="h-8 text-xs" required />
                    </div>
                    <div>
                      <Label className="text-[11px]">Tags (comma separated)</Label>
                      <Input value={formData.tags}
                        onChange={(e) => setFormData(f => ({ ...f, tags: e.target.value }))}
                        placeholder="mets, baseball, news" className="h-8 text-xs" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px]">Featured Image</Label>
                    <div className="flex gap-1.5 items-center">
                      <Input value={formData.featured_image_url}
                        onChange={(e) => setFormData(f => ({ ...f, featured_image_url: e.target.value }))}
                        placeholder="https://… or upload" className="h-8 text-xs flex-1" />
                      <Input type="file" accept="image/*" onChange={handleFeaturedImageUpload}
                        disabled={uploadingFeatured} className="cursor-pointer text-[10px] h-8 w-32" />
                      {uploadingFeatured && <Loader2 className="w-3 h-3 animate-spin" />}
                    </div>
                    {formData.featured_image_url && (
                      <img src={formData.featured_image_url} alt="" className="mt-1.5 h-20 rounded object-cover" />
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px] mb-1 block">Article Content · {wordCount} words</Label>
                    <RichTextEditor
                      value={formData.content}
                      onChange={(html) => setFormData(f => ({ ...f, content: html }))}
                      placeholder="Start writing… use the toolbar to format."
                      onImageUploadRequest={() => editorImageInputRef.current?.click()}
                    />
                    <input ref={editorImageInputRef} type="file" accept="image/*"
                      onChange={handleEditorImageUpload} className="hidden" />
                    {uploadingImage && (
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading inline image…
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px]">Audio (optional)</Label>
                    <div className="flex gap-1.5 items-center">
                      <Input value={formData.audio_url}
                        onChange={(e) => setFormData(f => ({ ...f, audio_url: e.target.value }))}
                        placeholder="https://… or upload" className="h-8 text-xs flex-1" />
                      <Input type="file" accept="audio/*" onChange={handleAudioUpload}
                        disabled={uploadingAudio} className="cursor-pointer text-[10px] h-8 w-32" />
                      {uploadingAudio && <Music className="w-3 h-3 animate-pulse" />}
                    </div>
                  </div>
                </TabsContent>

                {/* SEO TAB */}
                <TabsContent value="seo" className="space-y-2 mt-3">
                  <div>
                    <Label className="text-[11px]">URL Slug</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">/blog/</span>
                      <Input value={formData.slug}
                        onChange={(e) => { setAutoSlug(false); setFormData(f => ({ ...f, slug: slugify(e.target.value) })); }}
                        placeholder="article-url-slug" className="h-8 text-xs flex-1" required />
                      {!editingPost && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] px-2"
                          onClick={() => { setAutoSlug(true); setFormData(f => ({ ...f, slug: slugify(f.title) })); }}>
                          Auto
                        </Button>
                      )}
                    </div>
                    {slugConflict && (
                      <p className="text-[10px] text-red-400 mt-1">⚠️ Slug already in use by another article.</p>
                    )}
                    {formData.slug && !slugConflict && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        Public URL: <span className="text-primary">{SITE_URL}/blog/{formData.slug}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px] mb-1 block">Excerpt (used in cards & social previews)</Label>
                    <Textarea value={formData.excerpt}
                      onChange={(e) => setFormData(f => ({ ...f, excerpt: e.target.value }))}
                      rows={2} className="text-xs min-h-[50px]"
                      placeholder="Brief summary for cards & social shares" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formData.excerpt.length}/500</p>
                  </div>

                  <div>
                    <Label className="text-[11px]">Meta Description (≤160 chars)</Label>
                    <Textarea value={formData.meta_description}
                      onChange={(e) => setFormData(f => ({ ...f, meta_description: e.target.value }))}
                      rows={2} className="text-xs min-h-[50px]"
                      placeholder="SEO description shown in Google results" />
                    <p className={`text-[10px] mt-0.5 ${formData.meta_description.length > 160 ? "text-red-400" : "text-muted-foreground"}`}>
                      {formData.meta_description.length}/160
                    </p>
                  </div>

                  {/* Social preview */}
                  <div className="border border-border/40 rounded-md p-2 bg-card/50">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Social Share Preview</p>
                    <div className="rounded border border-border/40 overflow-hidden">
                      {formData.featured_image_url && (
                        <div className="aspect-[1200/630] bg-muted overflow-hidden">
                          <img src={formData.featured_image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-2 bg-background/50">
                        <p className="text-[9px] uppercase text-muted-foreground">metsxmfanzone.com</p>
                        <p className="text-xs font-semibold line-clamp-2">{formData.title || "Article title…"}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                          {formData.meta_description || formData.excerpt || "Description…"}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* PUBLISH TAB */}
                <TabsContent value="publish" className="space-y-3 mt-3">
                  <div className="flex items-center justify-between rounded-md border border-border/40 p-3">
                    <div>
                      <Label className="text-xs font-semibold">Publish Now</Label>
                      <p className="text-[10px] text-muted-foreground">Make this article live immediately.</p>
                    </div>
                    <Switch checked={formData.published}
                      onCheckedChange={(checked) => setFormData(f => ({ ...f, published: checked, scheduled_publish_at: checked ? "" : f.scheduled_publish_at }))} />
                  </div>

                  <div className="rounded-md border border-border/40 p-3 space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5" /> Schedule for Later
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Set a future date/time. Article auto-publishes when the scheduler runs.
                    </p>
                    <Input type="datetime-local"
                      value={formData.scheduled_publish_at}
                      onChange={(e) => setFormData(f => ({ ...f, scheduled_publish_at: e.target.value, published: e.target.value ? false : f.published }))}
                      className="h-8 text-xs" />
                    {isScheduledFuture && (
                      <p className="text-[10px] text-blue-400">
                        ⏰ Will publish on {new Date(formData.scheduled_publish_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="rounded-md border border-border/40 p-3 bg-muted/20">
                    <p className="text-[11px] font-medium mb-1">Status Summary</p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5">
                      <li>• {formData.published ? "✅ Will be published immediately" : isScheduledFuture ? `⏰ Scheduled for ${new Date(formData.scheduled_publish_at).toLocaleString()}` : "📝 Will be saved as draft"}</li>
                      <li>• Slug: <span className="text-foreground">/blog/{formData.slug || "—"}</span></li>
                      <li>• Words: {wordCount}</li>
                    </ul>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={slugConflict}>
                  {editingPost ? "Update Article" : "Save Article"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                        <Button variant="ghost" size="sm" className="h-7 px-1.5" title="Open"
                          onClick={() => window.open(`/blog/${post.slug}`, "_blank")}>
                          <Eye className="w-3 h-3" />
                        </Button>
                      )}
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
                        onClick={() => handleEdit(post)}>
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
