import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { forgetDraftsWaiting } from "@/hooks/useDraftsWaiting";
import ArticleBody from "@/components/blog/ArticleBody";
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
import {
  draftStamp,
  getDraft,
  htmlToText,
  isPostDraftId,
  publishDraft,
  setDraftStatus,
  textToHtml,
  updateDraft,
  type Draft,
  type DraftEdits,
} from "@/lib/draftsApi";

const META_LIMIT = 160;

const label = "text-[12px] font-extrabold tracking-wider text-[#FF9A6B]";
const field =
  "w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-[16px] leading-snug text-white placeholder:text-slate-400 focus:border-[#FF5910] focus:outline-none";
const ghostBtn =
  "flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/25 text-[15px] font-bold text-white active:bg-white/10 disabled:opacity-50";
const primaryBtn =
  "flex min-h-12 flex-[2] items-center justify-center rounded-xl bg-[#FF5910] text-[16px] font-extrabold text-[#0B1730] active:opacity-90 disabled:opacity-50";

const Counter = ({ value }: { value: string }) => (
  <span className={`text-[12px] ${value.length > META_LIMIT ? "font-bold text-red-300" : "text-slate-300"}`}>
    {value.length} / {META_LIMIT}
  </span>
);

/** One draft, full size: read everything, fix anything, then approve & publish or reject. */
export default function DraftReview({
  draftId,
  embedded = false,
  onChanged,
}: {
  /** Draft to show. Without it the id comes from the address (phone layout). */
  draftId?: string;
  /** True inside the desktop two-pane layout: no back button, narrower chrome. */
  embedded?: boolean;
  /** Called after the draft changed (saved, approved, rejected, moved) so the list can refresh. */
  onChanged?: () => void;
} = {}) {
  const params = useParams();
  const id = draftId ?? params.id ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [grammarlyDone, setGrammarlyDone] = useState(false);
  const [flagged, setFlagged] = useState(false);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [meta, setMeta] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDraft(await getDraft(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this draft");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const originalText = useMemo(() => (draft ? htmlToText(draft.content) : ""), [draft]);

  const startEdit = () => {
    if (!draft) return;
    // Articles saved in the blog table open in the full editor (cover image, audio, schedule).
    if (isPostDraftId(draft.id)) {
      navigate(`/admin/drafts/${draft.id}/edit`);
      return;
    }
    setTitle(draft.title);
    setText(originalText);
    setSummary(draft.summary);
    setMeta(draft.meta_description);
    setTags(draft.tags.join(", "));
    setCategory(draft.category);
    setEditing(true);
  };

  const fail = (what: string, e: unknown) =>
    toast({ title: what, description: e instanceof Error ? e.message : undefined, variant: "destructive" });

  const save = async () => {
    if (!draft) return;
    if (meta.trim().length > META_LIMIT) {
      toast({ title: "Google description is too long", description: `Keep it to ${META_LIMIT} characters or fewer.`, variant: "destructive" });
      return;
    }
    const edits: DraftEdits = {};
    if (title.trim() !== draft.title) edits.title = title.trim();
    if (text.trim() !== originalText.trim()) edits.content = textToHtml(text);
    if (summary.trim() !== draft.summary) edits.summary = summary.trim();
    if (meta.trim() !== draft.meta_description) edits.meta_description = meta.trim();
    if (category.trim() !== draft.category) edits.category = category.trim();
    const nextTags = [...new Set(tags.split(",").map((t) => t.trim()).filter(Boolean))];
    if (nextTags.join("|") !== draft.tags.join("|")) edits.tags = nextTags;

    if (!Object.keys(edits).length) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      setDraft(await updateDraft(draft.id, edits));
      onChanged?.();
      setEditing(false);
      toast({ title: "Changes saved" });
    } catch (e) {
      fail("Could not save your changes", e);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!draft) return;
    setConfirmOpen(false);
    setBusy(true);
    try {
      const live = await publishDraft(draft);
      forgetDraftsWaiting();
      onChanged?.();
      toast({
        title: live.alreadyLive ? "Already live, draft marked approved" : "Approved & published",
        description: live.alreadyLive ? undefined : "The article is live and subscribers were notified.",
      });
      navigate("/admin/drafts");
    } catch (e) {
      fail("Could not publish", e);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const move = async (to: "rejected" | "pending") => {
    if (!draft) return;
    setBusy(true);
    try {
      await setDraftStatus(draft.id, to);
      forgetDraftsWaiting();
      onChanged?.();
      toast({ title: to === "rejected" ? "Rejected" : "Moved back to Waiting" });
      if (to === "rejected") navigate("/admin/drafts");
      else await load();
    } catch (e) {
      fail("Could not update the draft", e);
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Link
      to="/admin/drafts"
      aria-label="Back to drafts"
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#14223F] text-white active:bg-[#1b2d52]"
    >
      <ChevronLeft className="h-5 w-5" />
    </Link>
  );
  const shell = embedded ? "w-full max-w-3xl" : "mx-auto w-full max-w-2xl";

  if (loading) return <p className="py-10 text-center text-[14px] text-slate-300">Loading draft…</p>;

  if (error || !draft) {
    return (
      <div className={`${shell} space-y-3`}>
        {!embedded && back}
        <div role="alert" className="space-y-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-4">
          <p className="text-[14px] text-red-100">{error || "Draft not found"}</p>
          <button type="button" onClick={load} className="min-h-11 rounded-xl border border-white/25 px-4 text-[14px] font-bold text-white">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isPending = draft.status === "pending";

  return (
    <div className={shell}>
      <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
        {!embedded && back}
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-extrabold leading-tight text-white">{editing ? "Edit draft" : "Review draft"}</p>
          <p className="text-[13px] text-slate-300">
            {draftStamp(draft.created_at)} ·{" "}
            {draft.status === "pending" ? "Waiting for you" : draft.status === "approved" ? "Approved" : "Rejected"}
          </p>
        </div>
      </div>

      {editing ? (
        <div className="space-y-5 pb-4">
          <div className="space-y-2">
            <label htmlFor="d-title" className={label}>TITLE</label>
            <input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </div>
          <div className="space-y-2">
            <label htmlFor="d-text" className={label}>ARTICLE</label>
            <textarea id="d-text" value={text} onChange={(e) => setText(e.target.value)} rows={16} className={`${field} min-h-[320px]`} />
            <p className="text-[12px] text-slate-300">
              Leave a blank line between paragraphs. Start a line with ## for a heading or - for a bullet. Bold and italics
              are only kept if you don't touch the article text.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="d-tags" className={label}>TAGS (separate with commas)</label>
            <input id="d-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={field} />
          </div>
          <div className="space-y-2">
            <label htmlFor="d-cat" className={label}>CATEGORY</label>
            <input id="d-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={field} />
          </div>
          <div className="space-y-2">
            <label htmlFor="d-sum" className={label}>SUMMARY · CARDS &amp; SOCIAL</label>
            <textarea id="d-sum" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={field} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="d-meta" className={label}>GOOGLE DESCRIPTION</label>
              <Counter value={meta} />
            </div>
            <textarea id="d-meta" value={meta} onChange={(e) => setMeta(e.target.value)} rows={3} className={field} />
          </div>
        </div>
      ) : (
        <div className="space-y-5 pb-4">
          <div className="space-y-2">
            <p className={label}>TITLE</p>
            <h2 className="!text-[22px] !font-extrabold !leading-tight">{draft.title}</h2>
          </div>

          <div className="space-y-2.5 rounded-2xl border border-white/10 bg-[#14223F] p-4">
            <p className={label}>ARTICLE</p>
            <ArticleBody content={draft.content} className="prose-p:text-[16px] prose-p:leading-relaxed" />
          </div>

          <div className="space-y-2">
            <p className={label}>TAGS</p>
            <div className="flex flex-wrap gap-2">
              {draft.tags.map((t) => (
                <span key={t} className="rounded-full border border-white/25 bg-[#14223F] px-3.5 py-2 text-[14px] text-white">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className={label}>CATEGORIES</p>
            <span className="inline-block rounded-full border border-white/25 bg-[#14223F] px-3.5 py-2 text-[14px] text-white">
              {draft.category}
            </span>
          </div>

          <div className="space-y-2">
            <p className={label}>SUMMARY · CARDS &amp; SOCIAL</p>
            <p className="text-[15px] leading-relaxed text-slate-200">{draft.summary}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={label}>GOOGLE DESCRIPTION</p>
              <Counter value={draft.meta_description} />
            </div>
            <p className="text-[15px] leading-relaxed text-slate-200">{draft.meta_description}</p>
          </div>

          {draft.sources.length > 0 && (
            <div className="space-y-2">
              <p className={label}>SOURCES</p>
              <ul className="space-y-1.5 text-[14px]">
                {draft.sources.map((s) => (
                  <li key={s} className="break-all">
                    <a href={s} target="_blank" rel="noopener noreferrer" className="text-[#FFB08A] underline">
                      {s}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isPending && (
            <OriginalityCard
              key={draft.id}
              draftId={draft.id}
              title={draft.title}
              html={draft.content}
              sources={draft.sources}
              onGrammarlyChange={setGrammarlyDone}
              onFlaggedChange={setFlagged}
            />
          )}
        </div>
      )}

      <div className="sticky bottom-0 z-20 -mx-3 space-y-2 border-t border-white/10 bg-[#0E1C43]/95 px-4 py-3 backdrop-blur sm:-mx-5">
        {editing ? (
          <div className="flex gap-2.5">
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className={ghostBtn}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={save} className={primaryBtn}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : isPending ? (
          <>
            <div className="flex gap-2.5">
              <button type="button" disabled={busy} onClick={() => move("rejected")} className={ghostBtn}>
                Reject
              </button>
              <button type="button" disabled={busy} onClick={startEdit} className={ghostBtn}>
                Edit
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(true)} className={primaryBtn}>
                {busy ? "Working…" : "Approve & publish"}
              </button>
            </div>
            <p className="text-center text-[12px] text-slate-300">Publishing also sends the new-article alert to subscribers</p>
            {!grammarlyDone && (
              <p className="text-center text-[12px] text-[#FFB08A]">Grammarly check not marked yet</p>
            )}
            {flagged && (
              <p className="text-center text-[12px] text-[#FFB08A]">The originality check flagged passages. Review them before publishing.</p>
            )}
          </>
        ) : draft.status === "rejected" ? (
          <button type="button" disabled={busy} onClick={() => move("pending")} className={`${ghostBtn} w-full`}>
            Move back to Waiting
          </button>
        ) : (
          <p className="text-center text-[14px] text-slate-200">
            Published to the site
            {draft.published_slug && (
              <>
                {" · "}
                <a href={`/blog/${draft.published_slug}`} target="_blank" rel="noopener noreferrer" className="font-bold text-[#FFB08A] underline">
                  Open article
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this article now?</AlertDialogTitle>
            <AlertDialogDescription>
              It goes live on metsxmfanzone.com right away and every subscriber gets the new-article alert.
              {!grammarlyDone && " You haven't marked the Grammarly check as done."}
              {flagged && " The originality check flagged passages that are close to another page."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={approve}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
