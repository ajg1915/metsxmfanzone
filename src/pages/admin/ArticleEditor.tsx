import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RichTextEditor from "@/components/admin/RichTextEditor";
import BlogShareDialog from "@/components/admin/BlogShareDialog";
import { validateFile } from "@/utils/fileValidation";
import {
  ArrowLeft, Save, Loader2, Code2, ImagePlus, Music, CalendarClock,
  Share2, Eye, CloudUpload, CheckCircle2, MonitorSmartphone,
} from "lucide-react";
import ArticlePreviewDialog from "@/components/admin/ArticlePreviewDialog";
import { z } from "zod";

const SITE_URL = "https://metsxmfanzone.com";

const schema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  slug: z.string().trim().min(1, "Slug is required").max(250).regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only"),
  content: z.string().trim().min(10, "Content must be at least 10 characters").max(100000),
  excerpt: z.string().trim().max(500).optional(),
  meta_description: z.string().trim().max(160, "Meta description should be ≤160 chars").optional(),
  category: z.string().trim().min(1, "Category is required").max(100),
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 250);

const emptyForm = {
  title: "", slug: "", content: "", excerpt: "", meta_description: "",
  featured_image_url: "", audio_url: "", category: "General", tags: "",
  published: false, scheduled_publish_at: "",
};
type FormState = typeof emptyForm;

export default function ArticleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const draftKey = `admin-article-draft-${id || "new"}`;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!id);
  const [htmlMode, setHtmlMode] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [uploading, setUploading] = useState<"featured" | "inline" | "audio" | null>(null);
  const [existingSlugs, setExistingSlugs] = useState<string[]>([]);
  const [savedPost, setSavedPost] = useState<{ id: string; title: string; slug: string; excerpt?: string | null; featured_image_url?: string | null } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const ready = useRef(false);
  const inlineInput = useRef<HTMLInputElement>(null);

  // Load post (edit) + any unsaved local draft
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let base: FormState = emptyForm;
      if (id) {
        const { data } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
        if (data) {
          base = {
            title: data.title || "",
            slug: data.slug || "",
            content: data.content || "",
            excerpt: data.excerpt || "",
            meta_description: (data as any).meta_description || "",
            featured_image_url: data.featured_image_url || "",
            audio_url: (data as any).audio_url || "",
            category: data.category || "General",
            tags: (data.tags || []).join(", "),
            published: !!data.published,
            scheduled_publish_at: (data as any).scheduled_publish_at
              ? new Date((data as any).scheduled_publish_at).toISOString().slice(0, 16)
              : "",
          };
          setSavedPost({ id: data.id, title: data.title, slug: data.slug, excerpt: data.excerpt, featured_image_url: data.featured_image_url });
        }
      }

      let next = base;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw);
          if (Date.now() - (d.savedAt || 0) < 7 * 24 * 60 * 60 * 1000) {
            const { savedAt: _s, ...rest } = d;
            next = { ...base, ...rest };
            if (!cancelled) setRestored(true);
          }
        }
      } catch { /* ignore */ }

      if (cancelled) return;
      setForm(next);
      setLoading(false);
      ready.current = true;
    })();

    supabase.from("blog_posts").select("slug, id").then(({ data }) => {
      setExistingSlugs(((data as any[]) || []).filter((p) => p.id !== id).map((p) => p.slug));
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-slug from title (new posts only)
  useEffect(() => {
    if (autoSlug && form.title) setForm((f) => ({ ...f, slug: slugify(f.title) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, autoSlug]);

  // Autosave — survives refresh for both new and edited articles
  const saveLocal = useCallback(() => {
    if (!ready.current) return;
    if (!form.title && !form.content) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ ...form, savedAt: Date.now() }));
      setSavedAt(Date.now());
    } catch { /* quota */ }
  }, [form, draftKey]);

  useEffect(() => {
    const t = setTimeout(saveLocal, 1200);
    return () => clearTimeout(t);
  }, [saveLocal]);

  useEffect(() => {
    const onHide = () => saveLocal();
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [saveLocal]);

  const clearLocal = () => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setSavedAt(null);
    setRestored(false);
  };

  const upload = async (
    file: File,
    kind: "featured" | "inline" | "audio",
  ) => {
    const isAudio = kind === "audio";
    const v = await validateFile(file, isAudio ? "audio" : "image", isAudio ? 50 : 5);
    if (!v.valid) { toast({ title: "Error", description: v.error, variant: "destructive" }); return null; }
    setUploading(kind);
    try {
      const { publicUrl } = await uploadToR2(file, isAudio ? "blog-audio" : "blog-images");
      return publicUrl;
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
      return null;
    } finally { setUploading(null); }
  };

  const wordCount = useMemo(() => {
    const txt = form.content.replace(/<[^>]*>/g, " ").trim();
    return txt ? txt.split(/\s+/).length : 0;
  }, [form.content]);

  const readMinutes = Math.max(1, Math.round(wordCount / 200));
  const slugConflict = !!form.slug && existingSlugs.includes(form.slug);
  const scheduledFuture = !!form.scheduled_publish_at && new Date(form.scheduled_publish_at).getTime() > Date.now();

  const save = async (publishOverride?: boolean) => {
    if (!user) return;
    const published = publishOverride ?? form.published;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check your article", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (slugConflict) {
      toast({ title: "Slug already in use", description: "Pick a different web address.", variant: "destructive" });
      return;
    }

    const scheduled = form.scheduled_publish_at ? new Date(form.scheduled_publish_at).toISOString() : null;
    const future = !!scheduled && new Date(scheduled).getTime() > Date.now();

    const payload: any = {
      title: form.title.trim(),
      slug: slugify(form.slug),
      content: form.content,
      excerpt: form.excerpt || null,
      meta_description: form.meta_description || null,
      featured_image_url: form.featured_image_url || null,
      audio_url: form.audio_url || null,
      category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      user_id: user.id,
      approval_status: "approved",
      scheduled_publish_at: scheduled,
      published: future ? false : published,
      published_at: future ? null : (published ? new Date().toISOString() : null),
      is_draft: !published && !future,
    };

    setSaving(true);
    try {
      let saved: any;
      if (id) {
        const { data, error } = await supabase.from("blog_posts").update(payload).eq("id", id).select().maybeSingle();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase.from("blog_posts").insert([payload]).select().maybeSingle();
        if (error) throw error;
        saved = data;
      }
      clearLocal();
      setForm((f) => ({ ...f, published: payload.published }));
      if (saved) setSavedPost({ id: saved.id, title: saved.title, slug: saved.slug, excerpt: saved.excerpt, featured_image_url: saved.featured_image_url });
      toast({
        title: published ? "Article published" : future ? "Article scheduled" : "Draft saved",
        description: published ? "It's live on your blog now." : undefined,
      });
      if (!id && saved?.id) navigate(`/admin/blog/edit/${saved.id}`, { replace: true });
    } catch (e: any) {
      const msg = e?.message?.includes("duplicate") ? "That web address is already used." : (e?.message || "Could not save");
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading article…</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 sm:pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/90 backdrop-blur border-b border-border/40">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate("/admin/blog")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{form.title || (id ? "Edit article" : "New article")}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span>{wordCount} words · {readMinutes} min read</span>
              {savedAt && (
                <span className="text-green-400 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> saved {new Date(savedAt).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            {savedPost && (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open(`/blog/${savedPost.slug}`, "_blank")}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> View
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShareOpen(true)}>
                  <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPreviewOpen(true)}>
              <MonitorSmartphone className="w-3.5 h-3.5 mr-1" /> Preview
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => save(false)} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1" /> Save draft
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => save(true)} disabled={saving || slugConflict}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5 mr-1" />}
              Publish
            </Button>
          </div>
        </div>
        {restored && (
          <div className="mt-1.5 flex items-center justify-between gap-2 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-1">
            <span className="text-[10px] text-amber-300">Restored your unsaved work from this device.</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { clearLocal(); window.location.reload(); }}>
              Discard
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="write" className="mt-3">
        <TabsList className="grid grid-cols-3 h-9 w-full">
          <TabsTrigger value="write" className="text-xs">Write</TabsTrigger>
          <TabsTrigger value="seo" className="text-xs">Preview &amp; SEO</TabsTrigger>
          <TabsTrigger value="publish" className="text-xs">Publish</TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="space-y-3 mt-3">
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Article headline…"
            className="h-12 text-base sm:text-lg font-semibold"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Category</Label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-[11px]">Tags (comma separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="mets, news" className="h-9 text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-[11px]">Cover image</Label>
            <div className="flex gap-2 items-center mt-1">
              <Input
                value={form.featured_image_url}
                onChange={(e) => setForm((f) => ({ ...f, featured_image_url: e.target.value }))}
                placeholder="Paste a link or upload"
                className="h-9 text-xs flex-1"
              />
              <label className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border/50 text-xs cursor-pointer">
                {uploading === "featured" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; e.target.value = "";
                  if (!file) return;
                  const url = await upload(file, "featured");
                  if (url) setForm((f) => ({ ...f, featured_image_url: url }));
                }} />
              </label>
            </div>
            {form.featured_image_url && (
              <img src={form.featured_image_url} alt="" className="mt-2 w-full max-h-48 rounded-md object-cover" />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[11px]">Article body</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setHtmlMode((v) => !v)}>
                <Code2 className="w-3 h-3 mr-1" /> {htmlMode ? "Visual editor" : "Edit HTML"}
              </Button>
            </div>
            {htmlMode ? (
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="font-mono text-[11px] min-h-[50vh]"
                spellCheck={false}
              />
            ) : (
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm((f) => ({ ...f, content: html }))}
                placeholder="Start writing… use the toolbar to format."
                onImageUploadRequest={() => inlineInput.current?.click()}
              />
            )}
            <input ref={inlineInput} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; e.target.value = "";
              if (!file) return;
              const url = await upload(file, "inline");
              if (url) setForm((f) => ({ ...f, content: f.content + `<p><img src="${url}" alt="" /></p>` }));
            }} />
            {uploading === "inline" && (
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Adding image…</p>
            )}
          </div>

          <div>
            <Label className="text-[11px]">Audio version (optional)</Label>
            <div className="flex gap-2 items-center mt-1">
              <Input value={form.audio_url} onChange={(e) => setForm((f) => ({ ...f, audio_url: e.target.value }))} placeholder="Paste a link or upload" className="h-9 text-xs flex-1" />
              <label className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border/50 text-xs cursor-pointer">
                {uploading === "audio" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
                Upload
                <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; e.target.value = "";
                  if (!file) return;
                  const url = await upload(file, "audio");
                  if (url) setForm((f) => ({ ...f, audio_url: url }));
                }} />
              </label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seo" className="space-y-3 mt-3">
          <div>
            <Label className="text-[11px]">Web address</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground">/blog/</span>
              <Input
                value={form.slug}
                onChange={(e) => { setAutoSlug(false); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }}
                className="h-9 text-xs flex-1"
              />
              <Button type="button" variant="ghost" size="sm" className="h-8 text-[10px]" onClick={() => { setAutoSlug(true); setForm((f) => ({ ...f, slug: slugify(f.title) })); }}>
                Auto
              </Button>
            </div>
            {slugConflict
              ? <p className="text-[10px] text-red-400 mt-1">That address is already used by another article.</p>
              : form.slug && <p className="text-[10px] text-muted-foreground mt-1 truncate">{SITE_URL}/blog/{form.slug}</p>}
          </div>

          <div>
            <Label className="text-[11px]">Summary (cards &amp; social)</Label>
            <Textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} rows={2} className="text-xs mt-1" />
            <p className="text-[10px] text-muted-foreground">{form.excerpt.length}/500</p>
          </div>

          <div>
            <Label className="text-[11px]">Google description (≤160)</Label>
            <Textarea value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} rows={2} className="text-xs mt-1" />
            <p className={`text-[10px] ${form.meta_description.length > 160 ? "text-red-400" : "text-muted-foreground"}`}>{form.meta_description.length}/160</p>
          </div>

          <div className="border border-border/40 rounded-md p-2 bg-card/50">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Social share preview</p>
            <div className="rounded border border-border/40 overflow-hidden">
              {form.featured_image_url && (
                <div className="aspect-[1200/630] bg-muted overflow-hidden">
                  <img src={form.featured_image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-2 bg-background/50">
                <p className="text-[9px] uppercase text-muted-foreground">metsxmfanzone.com</p>
                <p className="text-xs font-semibold line-clamp-2">{form.title || "Article title…"}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{form.meta_description || form.excerpt || "Description…"}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="publish" className="space-y-3 mt-3">
          <div className="flex items-center justify-between rounded-md border border-border/40 p-3">
            <div>
              <Label className="text-xs font-semibold">Live on the blog</Label>
              <p className="text-[10px] text-muted-foreground">Turn on to show this article publicly.</p>
            </div>
            <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v, scheduled_publish_at: v ? "" : f.scheduled_publish_at }))} />
          </div>

          <div className="rounded-md border border-border/40 p-3 space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Schedule for later</Label>
            <Input type="datetime-local" value={form.scheduled_publish_at}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_publish_at: e.target.value, published: e.target.value ? false : f.published }))}
              className="h-9 text-xs" />
            {scheduledFuture && <p className="text-[10px] text-blue-400">Publishes {new Date(form.scheduled_publish_at).toLocaleString()}</p>}
          </div>

          {savedPost && (
            <div className="rounded-md border border-border/40 p-3 space-y-2">
              <p className="text-[11px] font-medium">This article's own page</p>
              <p className="text-[10px] text-muted-foreground break-all">{SITE_URL}/blog/{savedPost.slug}</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open(`/blog/${savedPost.slug}`, "_blank")}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Open page
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open(`/blog-html/${savedPost.slug}`, "_blank")}>
                  <Code2 className="w-3.5 h-3.5 mr-1" /> Plain HTML page
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={() => setShareOpen(true)}>
                  <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border border-border/40 p-3 bg-muted/20 text-[10px] text-muted-foreground space-y-0.5">
            <p>Status: {form.published ? "Live" : scheduledFuture ? "Scheduled" : "Draft"}</p>
            <p>Words: {wordCount} · {readMinutes} min read</p>
            <p>Your work saves on this device automatically — a refresh won't lose it.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Mobile action bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/40 bg-background/95 backdrop-blur p-2 flex gap-2">
        {savedPost && (
          <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => setShareOpen(true)}>
            <Share2 className="w-4 h-4" />
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-10 flex-1 text-xs" onClick={() => save(false)} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> Save draft
        </Button>
        <Button variant="outline" size="sm" className="h-10 flex-1 text-xs" onClick={() => setPreviewOpen(true)}>
          <MonitorSmartphone className="w-4 h-4 mr-1" /> Preview
        </Button>
        <Button size="sm" className="h-10 flex-1 text-xs" onClick={() => save(true)} disabled={saving || slugConflict}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-1" />} Publish
        </Button>
      </div>

      {savedPost && <Badge className="sr-only">{savedPost.slug}</Badge>}
      <BlogShareDialog open={shareOpen} onOpenChange={setShareOpen} post={savedPost} />
      <ArticlePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={form.title}
        category={form.category}
        content={form.content}
        featuredImage={form.featured_image_url}
        readMinutes={readMinutes}
        publishing={saving}
        canPublish={!slugConflict}
        onPublish={async () => { await save(true); setPreviewOpen(false); }}
      />
    </div>
  );
}
