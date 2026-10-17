import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ImagePlus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { validateFile } from "@/utils/fileValidation";
import { useToast } from "@/hooks/use-toast";
import { forgetDraftsWaiting } from "@/hooks/useDraftsWaiting";
import RichTextEditor from "@/components/admin/RichTextEditor";
import BlogShareDialog from "@/components/admin/BlogShareDialog";
import OriginalityCard from "@/components/admin/OriginalityCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const META_LIMIT = 160;

const label = "text-[12px] font-extrabold tracking-wider text-[#FF9A6B]";
const field =
  "w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-[16px] leading-snug text-white placeholder:text-slate-400 focus:border-[#FF5910] focus:outline-none";
const ghostBtn =
  "flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/25 text-[15px] font-bold text-white active:bg-white/10 disabled:opacity-50";
const primaryBtn =
  "flex min-h-12 flex-[2] items-center justify-center rounded-xl bg-[#FF5910] text-[16px] font-extrabold text-[#0B1730] active:opacity-90 disabled:opacity-50";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120) || "article";

const emptyForm = {
  title: "",
  content: "",
  excerpt: "",
  meta_description: "",
  category: "Mets News",
  tags: "",
  featured_image_url: "",
  audio_url: "",
  scheduled_publish_at: "",
};
type FormState = typeof emptyForm;

interface PostMeta {
  id: string | null;
  slug: string | null;
  published: boolean;
  published_at: string | null;
  approval_status: string | null;
}

const newMeta: PostMeta = { id: null, slug: null, published: false, published_at: null, approval_status: null };

const stamp = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(iso))
    : "";

/**
 * Write a new article or edit one that is waiting, scheduled or live, in the same look as the Drafts page.
 * Routes: /admin/drafts/new and /admin/drafts/<post-id>/edit
 */
export default function DraftEditor() {
  const { id } = useParams();
  const rawId = id ? id.replace(/^post-/, "") : null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const draftKey = `drafts-editor-${rawId || "new"}`;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [meta, setMeta] = useState<PostMeta>(newMeta);
  const [loading, setLoading] = useState(!!rawId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "inline" | "audio" | null>(null);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [grammarlyDone, setGrammarlyDone] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingLocal, setPendingLocal] = useState<FormState | null>(null);

  const ready = useRef(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const inlineInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  const live = meta.published;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // ----- load -----
  useEffect(() => {
    let cancelled = false;
    ready.current = false;
    (async () => {
      let base: FormState = emptyForm;
      let nextMeta: PostMeta = newMeta;
      if (rawId) {
        const { data, error } = await supabase.from("blog_posts").select("*").eq("id", rawId).maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          setLoadError("Could not find this article.");
          setLoading(false);
          return;
        }
        const d = data as any;
        base = {
          title: d.title || "",
          content: d.content || "",
          excerpt: d.excerpt || "",
          meta_description: d.meta_description || "",
          category: d.category || "Mets News",
          tags: (d.tags || []).join(", "),
          featured_image_url: d.featured_image_url || "",
          audio_url: d.audio_url || "",
          scheduled_publish_at: d.scheduled_publish_at ? new Date(d.scheduled_publish_at).toISOString().slice(0, 16) : "",
        };
        nextMeta = {
          id: d.id,
          slug: d.slug,
          published: !!d.published,
          published_at: d.published_at || null,
          approval_status: d.approval_status || null,
        };
      }

      let pending: FormState | null = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const fresh = Date.now() - (parsed.savedAt || 0) < 7 * 24 * 3600 * 1000;
          delete parsed.savedAt;
          const merged = { ...base, ...parsed } as FormState;
          if (fresh && (merged.title || merged.content) && JSON.stringify(merged) !== JSON.stringify(base)) pending = merged;
          else localStorage.removeItem(draftKey);
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      setForm(base);
      setMeta(nextMeta);
      setMode(base.scheduled_publish_at ? "schedule" : "now");
      setPendingLocal(pending);
      setLoading(false);
      ready.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId]);

  // ----- backup on this phone while typing -----
  const saveLocal = useCallback(() => {
    if (!ready.current || pendingLocal) return;
    if (!form.title && !form.content) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ ...form, savedAt: Date.now() }));
    } catch {
      /* quota */
    }
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
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  };

  // ----- uploads -----
  const upload = async (file: File, kind: "cover" | "inline" | "audio") => {
    const isAudio = kind === "audio";
    const v = await validateFile(file, isAudio ? "audio" : "image", isAudio ? 50 : 5);
    if (!v.valid) {
      toast({ title: "Could not use that file", description: v.error, variant: "destructive" });
      return null;
    }
    setUploading(kind);
    try {
      const { publicUrl } = await uploadToR2(file, isAudio ? "blog-audio" : "blog-images");
      return publicUrl;
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      return null;
    } finally {
      setUploading(null);
    }
  };

  const onPick = (kind: "cover" | "inline" | "audio") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await upload(file, kind);
    if (!url) return;
    if (kind === "cover") set("featured_image_url", url);
    else if (kind === "audio") set("audio_url", url);
    else setForm((f) => ({ ...f, content: f.content + `<p><img src="${url}" alt="" /></p>` }));
  };

  // ----- saving -----
  const words = useMemo(() => {
    const t = form.content.replace(/<[^>]*>/g, " ").trim();
    return t ? t.split(/\s+/).length : 0;
  }, [form.content]);

  const tagList = () => [...new Set(form.tags.split(",").map((t) => t.trim()).filter(Boolean))];

  const problem = (): string | null => {
    if (form.title.trim().length < 3) return "Add a headline of at least 3 characters.";
    if (words < 3) return "Write the article first.";
    if (form.meta_description.trim().length > META_LIMIT) return `Keep the Google description to ${META_LIMIT} characters or fewer.`;
    if (!form.category.trim()) return "Add a category.";
    return null;
  };

  const uniqueSlug = async (title: string) => {
    const base = slugify(title);
    const day = new Date().toISOString().slice(0, 10);
    for (const slug of [base, `${base}-${day}`, `${base}-${day}-2`, `${base}-${day}-3`]) {
      const { data } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
      if (!data) return slug;
    }
    return `${base}-${Date.now()}`;
  };

  const fields = () => ({
    title: form.title.trim(),
    content: form.content,
    excerpt: form.excerpt.trim() || null,
    meta_description: form.meta_description.trim() || null,
    featured_image_url: form.featured_image_url || null,
    audio_url: form.audio_url || null,
    category: form.category.trim(),
    tags: tagList(),
  });

  /** Writes the article (insert when new) and returns the saved row. */
  const persist = async (patch: Record<string, unknown>) => {
    if (meta.id) {
      const { data, error } = await supabase.from("blog_posts").update(patch as any).eq("id", meta.id).select("*").single();
      if (error || !data) throw new Error("Could not save the article");
      return data as any;
    }
    if (!user) throw new Error("Not signed in");
    const slug = await uniqueSlug(form.title);
    const { data, error } = await supabase
      .from("blog_posts")
      .insert([{ ...patch, slug, user_id: user.id } as any])
      .select("*")
      .single();
    if (error || !data) throw new Error("Could not save the article");
    return data as any;
  };

  const afterSave = (row: any) => {
    setMeta({
      id: row.id,
      slug: row.slug,
      published: !!row.published,
      published_at: row.published_at || null,
      approval_status: row.approval_status || null,
    });
    clearLocal();
    forgetDraftsWaiting();
    setSavedAt(new Date().toISOString());
  };

  const fail = (what: string, e: unknown) =>
    toast({ title: what, description: e instanceof Error ? e.message : undefined, variant: "destructive" });

  const saveDraft = async () => {
    const p = problem();
    if (p && !(form.title.trim().length >= 3)) {
      toast({ title: "Check your article", description: p, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const row = await persist(
        live
          ? fields() // a live article keeps its status; this just saves the changes
          : { ...fields(), approval_status: "pending", published: false, is_draft: false, scheduled_publish_at: null },
      );
      afterSave(row);
      toast({ title: live ? "Changes saved" : "Saved to Waiting" });
      if (!rawId) navigate(`/admin/drafts/post-${row.id}/edit`, { replace: true });
    } catch (e) {
      fail("Could not save", e);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setConfirm(null);
    const p = problem();
    if (p) {
      toast({ title: "Check your article", description: p, variant: "destructive" });
      return;
    }
    const when = form.scheduled_publish_at ? new Date(form.scheduled_publish_at) : null;
    const future = mode === "schedule" && !!when && when.getTime() > Date.now();
    if (mode === "schedule" && !future) {
      toast({ title: "Pick a time in the future", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      if (future) {
        const row = await persist({
          ...fields(),
          approval_status: "approved",
          published: false,
          is_draft: false,
          scheduled_publish_at: when!.toISOString(),
        });
        afterSave(row);
        toast({ title: "Scheduled", description: `It goes live ${stamp(when!.toISOString())} ET.` });
        navigate("/admin/drafts", { state: { tab: "published" } });
        return;
      }

      const wasLive = live;
      const row = await persist({
        ...fields(),
        approval_status: "approved",
        published: true,
        published_at: meta.published_at || new Date().toISOString(),
        is_draft: false,
        scheduled_publish_at: null,
      });
      afterSave(row);
      if (!wasLive) {
        try {
          await supabase.functions.invoke("send-push-notification", {
            body: {
              title: "📰 New Article on MetsXMFanZone!",
              body: row.title,
              url: `/blog/${row.slug}`,
              icon: "/logo-192.png",
              tag: `blog-${row.id}`,
            },
          });
        } catch (e) {
          console.error("Push failed:", e);
        }
      }
      setJustPublished(!wasLive);
      if (wasLive) {
        toast({ title: "Changes saved", description: "The live article is updated." });
      } else {
        setShareOpen(true);
      }
    } catch (e) {
      fail("Could not publish", e);
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    setConfirm(null);
    if (!meta.id) return;
    setBusy(true);
    try {
      const row = await persist({ approval_status: "pending", published: false, is_draft: false, scheduled_publish_at: null });
      afterSave(row);
      toast({ title: "Taken off the site", description: "It's back under Waiting." });
      navigate("/admin/drafts");
    } catch (e) {
      fail("Could not unpublish", e);
    } finally {
      setBusy(false);
    }
  };

  const closeShare = (open: boolean) => {
    setShareOpen(open);
    if (!open) navigate("/admin/drafts", { state: { tab: "published" } });
  };

  // ----- screen -----
  if (loading) return <p className="py-10 text-center text-[14px] text-slate-300">Loading article…</p>;

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3">
        <div role="alert" className="space-y-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-4">
          <p className="text-[14px] text-red-100">{loadError}</p>
          <Link to="/admin/drafts" className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 text-[14px] font-bold text-white">
            Back to Drafts
          </Link>
        </div>
      </div>
    );
  }

  const scheduled = !live && meta.approval_status === "approved" && !!form.scheduled_publish_at;
  const status = live ? "Live on the site" : scheduled ? "Scheduled" : meta.id ? "Waiting for approval" : "New article";
  const savedLine = savedAt ? `Saved ${stamp(savedAt)}` : meta.id ? "" : "Not saved yet";
  const sharePost = meta.id
    ? { id: meta.id, title: form.title, slug: meta.slug || "", excerpt: form.excerpt, featured_image_url: form.featured_image_url }
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
        <Link
          to="/admin/drafts"
          aria-label="Back to drafts"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#14223F] text-white active:bg-[#1b2d52]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-extrabold leading-tight text-white">{rawId ? "Edit article" : "Write new article"}</p>
          <p className="text-[13px] text-slate-300">{[savedLine, status].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      {pendingLocal && (
        <div className="mb-4 space-y-3 rounded-2xl border border-[#FF9A6B]/50 bg-[#FF5910]/10 p-4">
          <p className="text-[14px] text-white">Unsaved changes from this phone were found for this article.</p>
          <div className="flex gap-2.5">
            <button
              type="button"
              className={ghostBtn}
              onClick={() => {
                clearLocal();
                setPendingLocal(null);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={() => {
                setForm(pendingLocal);
                setMode(pendingLocal.scheduled_publish_at ? "schedule" : "now");
                setPendingLocal(null);
              }}
            >
              Continue where I left off
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 pb-4">
        <div className="space-y-2">
          <p className={label}>COVER IMAGE</p>
          {form.featured_image_url ? (
            <img src={form.featured_image_url} alt="" className="h-48 w-full rounded-2xl object-cover" />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/35 bg-[#14223F] px-4 text-center text-slate-300">
              <ImagePlus className="h-8 w-8" />
              <span className="text-[14px]">Shows on cards, the home slides and when shared</span>
            </div>
          )}
          <div className="flex gap-2.5">
            <button type="button" disabled={uploading === "cover"} onClick={() => coverInput.current?.click()} className={ghostBtn}>
              {uploading === "cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : form.featured_image_url ? "Replace cover image" : "Upload cover image"}
            </button>
            {form.featured_image_url && (
              <button type="button" onClick={() => set("featured_image_url", "")} className={`${ghostBtn} flex-none px-5`}>
                Remove
              </button>
            )}
          </div>
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={onPick("cover")} />
        </div>

        <div className="space-y-2">
          <label htmlFor="d-title" className={label}>TITLE</label>
          <input id="d-title" value={form.title} onChange={(e) => set("title", e.target.value)} className={field} />
        </div>

        <div className="space-y-2">
          <p className={label}>ARTICLE</p>
          <RichTextEditor
            tone="drafts"
            value={form.content}
            onChange={(html) => set("content", html)}
            placeholder="Start writing your article…"
            onImageUploadRequest={() => inlineInput.current?.click()}
          />
          <input ref={inlineInput} type="file" accept="image/*" hidden onChange={onPick("inline")} />
          <p className="text-[12px] text-slate-300">
            {words} words{uploading === "inline" ? " · uploading image…" : ""}
          </p>
        </div>

        {!live && (
          <OriginalityCard
            key={rawId || "new"}
            draftId={rawId || "new"}
            title={form.title}
            html={form.content}
            sources={[]}
            onGrammarlyChange={setGrammarlyDone}
            onResult={(r) => setFlagged(r?.level === "review")}
          />
        )}

        <div className="space-y-2">
          <label htmlFor="d-tags" className={label}>TAGS (separate with commas)</label>
          <input id="d-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} className={field} />
        </div>

        <div className="space-y-2">
          <label htmlFor="d-cat" className={label}>CATEGORY</label>
          <input id="d-cat" value={form.category} onChange={(e) => set("category", e.target.value)} className={field} />
        </div>

        <div className="space-y-2">
          <label htmlFor="d-sum" className={label}>SUMMARY · CARDS &amp; SOCIAL</label>
          <textarea id="d-sum" value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={3} className={field} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="d-meta" className={label}>GOOGLE DESCRIPTION</label>
            <span className={`text-[12px] ${form.meta_description.length > META_LIMIT ? "font-bold text-red-300" : "text-slate-300"}`}>
              {form.meta_description.length} / {META_LIMIT}
            </span>
          </div>
          <textarea id="d-meta" value={form.meta_description} onChange={(e) => set("meta_description", e.target.value)} rows={3} className={field} />
        </div>

        <div className="space-y-2">
          <p className={label}>AUDIO (OPTIONAL)</p>
          <div className="flex gap-2.5">
            <button type="button" disabled={uploading === "audio"} onClick={() => audioInput.current?.click()} className={ghostBtn}>
              {uploading === "audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : form.audio_url ? "Replace audio version" : "Upload audio version"}
            </button>
            {form.audio_url && (
              <button type="button" onClick={() => set("audio_url", "")} className={`${ghostBtn} flex-none px-5`}>
                Remove
              </button>
            )}
          </div>
          {form.audio_url && <p className="text-[12px] text-emerald-300">Audio added.</p>}
          <input ref={audioInput} type="file" accept="audio/*" hidden onChange={onPick("audio")} />
        </div>

        {!live && (
          <div className="space-y-2">
            <p className={label}>WHEN</p>
            <div className="grid grid-cols-2 gap-2">
              {(["now", "schedule"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if (m === "now") set("scheduled_publish_at", "");
                  }}
                  className={`min-h-12 rounded-xl text-[15px] ${
                    mode === m ? "bg-[#FF5910] font-extrabold text-[#0B1730]" : "bg-[#14223F] font-semibold text-slate-200"
                  }`}
                >
                  {m === "now" ? "Publish now" : "Schedule"}
                </button>
              ))}
            </div>
            {mode === "schedule" && (
              <input
                type="datetime-local"
                aria-label="Publish date and time"
                value={form.scheduled_publish_at}
                onChange={(e) => set("scheduled_publish_at", e.target.value)}
                className={field}
                style={{ colorScheme: "dark" }}
              />
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 -mx-3 space-y-2 border-t border-white/10 bg-[#0E1C43]/95 px-4 py-3 backdrop-blur sm:-mx-5">
        {live ? (
          <div className="flex gap-2.5">
            <button type="button" disabled={busy} onClick={() => setConfirm("unpublish")} className={ghostBtn}>
              Unpublish
            </button>
            <button type="button" disabled={busy || !sharePost} onClick={() => { setJustPublished(false); setShareOpen(true); }} className={ghostBtn}>
              Share
            </button>
            <button type="button" disabled={busy} onClick={publish} className={primaryBtn}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2.5">
              <button type="button" disabled={busy} onClick={saveDraft} className={ghostBtn}>
                Save draft
              </button>
              <button type="button" disabled={busy} onClick={() => (mode === "schedule" ? publish() : setConfirm("publish"))} className={primaryBtn}>
                {busy ? "Working…" : mode === "schedule" ? "Schedule" : "Approve & publish"}
              </button>
            </div>
            <p className="text-center text-[12px] text-slate-300">Publishing also sends the new-article alert to subscribers</p>
            {!grammarlyDone && <p className="text-center text-[12px] text-[#FFB08A]">Grammarly check not marked yet</p>}
            {flagged && <p className="text-center text-[12px] text-[#FFB08A]">The source check flagged passages. Review them before publishing.</p>}
          </>
        )}
      </div>

      <AlertDialog open={confirm === "publish"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this article now?</AlertDialogTitle>
            <AlertDialogDescription>
              It goes live on metsxmfanzone.com right away and every subscriber gets the new-article alert.
              {!grammarlyDone && " You haven't marked the Grammarly check as done."}
              {flagged && " The source check flagged passages that are close to a source."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={publish}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "unpublish"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take this article off the site?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops showing on the blog and moves back to Waiting. You can approve it again any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it live</AlertDialogCancel>
            <AlertDialogAction onClick={unpublish}>Unpublish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BlogShareDialog
        open={shareOpen}
        onOpenChange={justPublished ? closeShare : setShareOpen}
        post={sharePost}
        justPublished={justPublished}
      />
    </div>
  );
}
