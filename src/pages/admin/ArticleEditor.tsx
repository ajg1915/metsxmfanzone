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
import RichTextEditor from "@/components/admin/RichTextEditor";
import BlogShareDialog from "@/components/admin/BlogShareDialog";
import MediaPickerDialog from "@/components/admin/MediaPickerDialog";
import { validateFile } from "@/utils/fileValidation";
import {
  ArrowLeft, Save, Loader2, Code2, ImagePlus, Music, CalendarClock,
  Share2, Eye, CloudUpload, CheckCircle2, MonitorSmartphone, FolderOpen,
  ArrowRight, Check, Circle, RotateCcw,
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
  // Unsaved work found on this device. Never applied until the owner taps Continue.
  const [pendingLocal, setPendingLocal] = useState<(FormState & { savedAt?: number }) | null>(null);
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState<"featured" | "inline" | "audio" | null>(null);
  const [existingSlugs, setExistingSlugs] = useState<string[]>([]);
  const [savedPost, setSavedPost] = useState<{ id: string; title: string; slug: string; excerpt?: string | null; featured_image_url?: string | null } | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [wasLive, setWasLive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [picker, setPicker] = useState<{ open: boolean; target: "featured" | "inline" | "audio" }>({ open: false, target: "featured" });

  const ready = useRef(false);
  // After a save, ignore autosaves of that exact text so a late timer can't bring the article back.
  const blockedSnap = useRef<string | null>(null);
  const inlineInput = useRef<HTMLInputElement>(null);

  const handlePickedFromLibrary = (url: string) => {
    if (picker.target === "featured") {
      setForm((f) => ({ ...f, featured_image_url: url }));
    } else if (picker.target === "audio") {
      setForm((f) => ({ ...f, audio_url: url }));
    } else {
      setForm((f) => ({ ...f, content: f.content + `<p><img src="${url}" alt="" /></p>` }));
    }
  };

  // Load post (edit) + any unsaved local draft
  useEffect(() => {
    let cancelled = false;
    ready.current = false;
    blockedSnap.current = null;
    setStep(0);
    (async () => {
      let base: FormState = emptyForm;
      if (id) {
        const { data } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
        if (data) {
          setApprovalStatus((data as any).approval_status ?? null);
          setWasLive(!!data.published);
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

      let pending: (FormState & { savedAt?: number }) | null = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw);
          const fresh = Date.now() - (d.savedAt || 0) < 7 * 24 * 60 * 60 * 1000;
          const merged = { ...base, ...d };
          delete (merged as any).savedAt;
          const differs = JSON.stringify(merged) !== JSON.stringify(base);
          if (fresh && (d.title || d.content) && differs) pending = d;
          else localStorage.removeItem(draftKey);
        }
      } catch { /* ignore */ }

      if (cancelled) return;
      setForm(base);
      setPendingLocal(pending);
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
  }, [form.title, autoSlug]);

  // Autosave — survives refresh for both new and edited articles
  const saveLocal = useCallback(() => {
    if (!ready.current || pendingLocal) return;
    if (!form.title && !form.content) return;
    if (blockedSnap.current !== null && JSON.stringify(form) === blockedSnap.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ ...form, savedAt: Date.now() }));
      setSavedAt(Date.now());
    } catch { /* quota */ }
  }, [form, draftKey, pendingLocal]);

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

  const continueLocal = () => {
    if (!pendingLocal) return;
    const { savedAt: _s, ...rest } = pendingLocal;
    setForm((f) => ({ ...f, ...rest }));
    setPendingLocal(null);
    setRestored(true);
  };

  const startFresh = () => {
    clearLocal();
    setPendingLocal(null);
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
      // Pending articles (e.g. the daily drafts) stay pending until approved;
      // publishing or scheduling from the editor counts as approval.
      ...(id && approvalStatus === "pending" && !published && !future
        ? {}
        : { approval_status: "approved" }),
      scheduled_publish_at: scheduled,
      published: future ? false : published,
      published_at: future ? null : (published ? new Date().toISOString() : null),
      is_draft: !published && !future,
    };

    blockedSnap.current = JSON.stringify(form);
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

      // Same subscriber push the approve button sends, once, when an article first goes live
      if (payload.published && !wasLive) {
        try {
          await supabase.functions.invoke("send-push-notification", {
            body: { title: "📰 New Article on MetsXMFanZone!", body: payload.title, url: `/blog/${payload.slug}`, icon: "/logo-192.png", tag: `blog-${saved?.id ?? payload.slug}` },
          });
        } catch (e) { console.error("Push failed:", e); }
      }

      toast({
        title: published ? "Article published" : future ? "Article scheduled" : "Draft saved",
        description: published ? "It's live on your blog now." : undefined,
      });

      if (published || future) {
        // Finished article: clear the form for the next one
        setForm(emptyForm);
        setSavedPost(null);
        setApprovalStatus(null);
        setWasLive(false);
        setAutoSlug(true);
        setStep(0);
        navigate("/admin/blog/new");
      } else {
        setForm((f) => ({ ...f, published: payload.published }));
        if (saved) {
          setSavedPost({ id: saved.id, title: saved.title, slug: saved.slug, excerpt: saved.excerpt, featured_image_url: saved.featured_image_url });
          setApprovalStatus(saved.approval_status ?? null);
        }
        if (!id && saved?.id) navigate(`/admin/blog/edit/${saved.id}`, { replace: true });
      }
    } catch (e: any) {
      const msg = e?.message?.includes("duplicate") ? "That web address is already used." : (e?.message || "Could not save");
      blockedSnap.current = null;
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading article…</div>;
  }

  const STEPS = ["Write", "Details", "Publish"] as const;
  const goStep = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const checks = [
    { ok: form.title.trim().length >= 3, label: "Headline" },
    { ok: wordCount >= 3, label: `Article (${wordCount} words)` },
    { ok: !!form.excerpt.trim(), label: "Summary" },
    { ok: !!form.meta_description.trim() && form.meta_description.length <= 160, label: "Google description" },
    { ok: !!form.featured_image_url, label: "Cover image" },
  ];

  const mediaInputs = (
    <>
      <input ref={inlineInput} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        const url = await upload(file, "inline");
        if (url) setForm((f) => ({ ...f, content: f.content + `<p><img src="${url}" alt="" /></p>` }));
      }} />
      <MediaPickerDialog
        open={picker.open}
        onOpenChange={(open) => setPicker((p) => ({ ...p, open }))}
        kind={picker.target === "audio" ? "audio" : "image"}
        onSelect={handlePickedFromLibrary}
      />
    </>
  );

  return (
    <div className="w-full max-w-3xl mx-auto pb-28 sm:pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-2 pb-2 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => navigate("/admin/blog")} aria-label="Back to articles">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{form.title || (id ? "Edit article" : "New article")}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span>{wordCount} words · {readMinutes} min read</span>
              {savedAt && (
                <span className="text-green-400 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> kept on this device
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setPreviewOpen(true)}>
            <MonitorSmartphone className="w-3.5 h-3.5 mr-1" /> Preview
          </Button>
        </div>

        {/* Step bar */}
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {STEPS.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => goStep(i)}
              className={`h-10 rounded-lg text-xs font-semibold border transition-colors ${
                step === i
                  ? "bg-primary text-primary-foreground border-primary"
                  : i < step
                    ? "bg-primary/10 text-foreground border-primary/30"
                    : "bg-card text-muted-foreground border-border/50"
              }`}
            >
              <span className="opacity-70 mr-1">{i + 1}</span>{name}
            </button>
          ))}
        </div>
      </div>

      {/* Unsaved work found: asks first, never silently loads old text */}
      {pendingLocal && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <p className="text-sm font-semibold text-amber-200">Unsaved work found on this device</p>
          <p className="text-xs text-amber-100/80 line-clamp-2">
            {pendingLocal.title || "Untitled"}
            {pendingLocal.savedAt ? ` · ${new Date(pendingLocal.savedAt).toLocaleString()}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" className="h-10 text-xs" onClick={continueLocal}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Continue it
            </Button>
            <Button size="sm" variant="outline" className="h-10 text-xs" onClick={startFresh}>
              Start fresh
            </Button>
          </div>
        </div>
      )}

      {restored && !pendingLocal && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
          <span className="text-xs text-amber-300">Continuing your unsaved work.</span>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { clearLocal(); window.location.reload(); }}>
            Discard
          </Button>
        </div>
      )}

      <div className={`mt-4 space-y-4 ${pendingLocal ? "opacity-40 pointer-events-none select-none" : ""}`}>
        {/* STEP 1: WRITE */}
        {step === 0 && (
          <>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Article headline…"
              className="h-14 text-lg font-semibold"
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Article</Label>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => setHtmlMode((v) => !v)}>
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
                  onMediaPick={() => setPicker({ open: true, target: "inline" })}
                />
              )}
              {uploading === "inline" && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Adding image…</p>
              )}
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 p-3 space-y-2">
              <Label className="text-xs">Cover image</Label>
              <div className="grid grid-cols-2 gap-2">
                <label className="inline-flex items-center justify-center gap-1 h-10 px-3 rounded-md border border-border/50 text-xs cursor-pointer">
                  {uploading === "featured" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; e.target.value = "";
                    if (!file) return;
                    const url = await upload(file, "featured");
                    if (url) setForm((f) => ({ ...f, featured_image_url: url }));
                  }} />
                </label>
                <Button type="button" variant="outline" className="h-10 px-3 text-xs" onClick={() => setPicker({ open: true, target: "featured" })}>
                  <FolderOpen className="w-3.5 h-3.5 mr-1" /> Media Library
                </Button>
              </div>
              {form.featured_image_url && (
                <img src={form.featured_image_url} alt="" className="w-full max-h-48 rounded-md object-cover" />
              )}
            </div>
          </>
        )}

        {/* STEP 2: DETAILS */}
        {step === 1 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="h-11 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Tags (comma separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="mets, news" className="h-11 text-sm mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Summary (cards &amp; social)</Label>
              <Textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} rows={3} className="text-sm mt-1" />
              <p className="text-[11px] text-muted-foreground mt-0.5">{form.excerpt.length}/500</p>
            </div>

            <div>
              <Label className="text-xs">Google description (160 characters or fewer)</Label>
              <Textarea value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} rows={3} className="text-sm mt-1" />
              <p className={`text-[11px] mt-0.5 ${form.meta_description.length > 160 ? "text-red-400" : "text-muted-foreground"}`}>{form.meta_description.length}/160</p>
            </div>

            <div>
              <Label className="text-xs">Web address</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground">/blog/</span>
                <Input
                  value={form.slug}
                  onChange={(e) => { setAutoSlug(false); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }}
                  className="h-11 text-xs flex-1"
                />
                <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setAutoSlug(true); setForm((f) => ({ ...f, slug: slugify(f.title) })); }}>
                  Auto
                </Button>
              </div>
              {slugConflict
                ? <p className="text-[11px] text-red-400 mt-1">That address is already used by another article.</p>
                : form.slug && <p className="text-[11px] text-muted-foreground mt-1 truncate">{SITE_URL}/blog/{form.slug}</p>}
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 p-3 space-y-2">
              <Label className="text-xs">Audio version (optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <label className="inline-flex items-center justify-center gap-1 h-10 px-3 rounded-md border border-border/50 text-xs cursor-pointer">
                  {uploading === "audio" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
                  Upload
                  <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; e.target.value = "";
                    if (!file) return;
                    const url = await upload(file, "audio");
                    if (url) setForm((f) => ({ ...f, audio_url: url }));
                  }} />
                </label>
                <Button type="button" variant="outline" className="h-10 px-3 text-xs" onClick={() => setPicker({ open: true, target: "audio" })}>
                  <FolderOpen className="w-3.5 h-3.5 mr-1" /> Media Library
                </Button>
              </div>
              {form.audio_url && <p className="text-[11px] text-green-400">Audio added.</p>}
            </div>

            <div className="border border-border/40 rounded-xl p-3 bg-card/50">
              <p className="text-[11px] font-medium text-muted-foreground mb-2">How it looks when shared</p>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                {form.featured_image_url && (
                  <div className="aspect-[1200/630] bg-muted overflow-hidden">
                    <img src={form.featured_image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-2.5 bg-background/50">
                  <p className="text-[10px] uppercase text-muted-foreground">metsxmfanzone.com</p>
                  <p className="text-sm font-semibold line-clamp-2">{form.title || "Article title…"}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{form.meta_description || form.excerpt || "Description…"}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* STEP 3: PUBLISH */}
        {step === 2 && (
          <>
            <div className="rounded-xl border border-border/50 bg-card/50 p-3">
              <p className="text-xs font-semibold mb-2">Before you publish</p>
              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-sm">
                    {c.ok ? <Check className="w-4 h-4 text-green-400" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                    <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-2">Status: {form.published ? "Live" : scheduledFuture ? "Scheduled" : "Draft"}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 p-3">
              <div className="pr-3">
                <Label className="text-sm font-semibold">Live on the blog</Label>
                <p className="text-[11px] text-muted-foreground">Turn on to show this article publicly.</p>
              </div>
              <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v, scheduled_publish_at: v ? "" : f.scheduled_publish_at }))} />
            </div>

            <div className="rounded-xl border border-border/50 p-3 space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> Schedule for later</Label>
              <Input type="datetime-local" value={form.scheduled_publish_at}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_publish_at: e.target.value, published: e.target.value ? false : f.published }))}
                className="h-11 text-sm" />
              {scheduledFuture && <p className="text-[11px] text-blue-400">Publishes {new Date(form.scheduled_publish_at).toLocaleString()}</p>}
            </div>

            {savedPost && (
              <div className="rounded-xl border border-border/50 p-3 space-y-2">
                <p className="text-xs font-medium">This article's own page</p>
                <p className="text-[11px] text-muted-foreground break-all">{SITE_URL}/blog/{savedPost.slug}</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="h-10 text-xs" onClick={() => window.open(`/blog/${savedPost.slug}`, "_blank")}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Open
                  </Button>
                  <Button variant="outline" size="sm" className="h-10 text-xs" onClick={() => window.open(`/blog-html/${savedPost.slug}`, "_blank")}>
                    <Code2 className="w-3.5 h-3.5 mr-1" /> HTML
                  </Button>
                  <Button size="sm" className="h-10 text-xs" onClick={() => setShareOpen(true)}>
                    <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                  </Button>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">Your work is kept on this device while you write. Starting a new article always opens a clean page.</p>
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border/40 bg-background/95 backdrop-blur p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" className="h-11 px-4 text-sm" onClick={() => goStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          {step < 2 ? (
            <Button size="sm" className="h-11 flex-1 text-sm" onClick={() => goStep(step + 1)}>
              {step === 0 ? "Next: Details" : "Next: Publish"} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" className="h-11 flex-1 text-sm" onClick={() => save(false)} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> Save draft
              </Button>
              <Button size="sm" className="h-11 flex-1 text-sm" onClick={() => save(true)} disabled={saving || slugConflict}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-1" />} Publish
              </Button>
            </>
          )}
        </div>
      </div>

      {mediaInputs}
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
