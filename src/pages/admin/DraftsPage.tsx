import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, ImageIcon, Plus, RefreshCw, Share2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { forgetDraftsWaiting } from "@/hooks/useDraftsWaiting";
import BlogShareDialog from "@/components/admin/BlogShareDialog";
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
  countPublished,
  daysWaiting,
  deletePost,
  draftCounts,
  draftStamp,
  isPostDraftId,
  listDrafts,
  listPublished,
  setDraftStatus,
  type DraftStatus,
  type DraftSummary,
  type PublishedPost,
} from "@/lib/draftsApi";

type Tab = "pending" | "published" | "rejected";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
];

const EMPTY: Record<Tab, string> = {
  pending: "No drafts waiting. Each morning's article shows up here for you to approve.",
  published: "No published articles yet. Approve a draft or write a new article.",
  rejected: "Nothing rejected.",
};

const ghost =
  "flex min-h-12 items-center justify-center rounded-xl border border-white/25 text-[15px] font-bold text-white active:bg-white/10 disabled:opacity-50";

/** Every article in one place: write, read, approve, publish, share and edit. */
export default function DraftsPage({
  compact = false,
  selectedId,
  refreshKey = 0,
}: {
  /** Desktop left pane: fills its column instead of centring a narrow page. */
  compact?: boolean;
  /** Highlights the draft that is open in the right pane. */
  selectedId?: string;
  /** Bump to reload the list after the right pane changed a draft. */
  refreshKey?: number;
} = {}) {
  const { toast } = useToast();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => {
    const t = (location.state as { tab?: Tab } | null)?.tab;
    return t === "published" || t === "rejected" ? t : "pending";
  });
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [published, setPublished] = useState<PublishedPost[]>([]);
  const [counts, setCounts] = useState<Record<Tab, number | undefined>>({ pending: undefined, published: undefined, rejected: undefined });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<PublishedPost | null>(null);
  const [deleting, setDeleting] = useState<PublishedPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const counted = Promise.all([draftCounts().catch(() => null), countPublished().catch(() => null)]);
      if (tab === "published") setPublished(await listPublished());
      else setDrafts(await listDrafts(tab as DraftStatus));
      const [c, pub] = await counted;
      setCounts({
        pending: c?.pending,
        rejected: c?.rejected,
        published: pub ?? undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load drafts");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const move = async (draft: DraftSummary, to: DraftStatus) => {
    setBusyId(draft.id);
    try {
      await setDraftStatus(draft.id, to);
      forgetDraftsWaiting();
      toast({
        title: to === "rejected" ? "Rejected" : "Moved back to Waiting",
        description: to === "rejected" ? "You can find it under Rejected and bring it back." : undefined,
      });
      await load();
    } catch (e) {
      toast({
        title: "Could not update the draft",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    const post = deleting;
    if (!post) return;
    setDeleting(null);
    setBusyId(post.id);
    try {
      await deletePost(post.postId);
      toast({ title: "Article deleted" });
      await load();
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const list = tab === "published" ? published : drafts;

  return (
    <div className={compact ? "w-full space-y-4" : "mx-auto w-full max-w-2xl space-y-4"}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1>Drafts</h1>
          <p className="text-[13px] text-slate-300">Write, approve, publish and share from here</p>
        </div>
        <button
          type="button"
          onClick={load}
          aria-label="Refresh drafts"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/15 text-slate-200 active:bg-white/10"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <Link
        to="/admin/drafts/new"
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#FF5910] text-[17px] font-extrabold text-[#0B1730] active:opacity-90"
      >
        <Plus className="h-5 w-5" strokeWidth={2.75} />
        Write new article
      </Link>

      <div role="tablist" aria-label="Draft status" className="grid grid-cols-3 gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          const n = counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[15px] ${
                active
                  ? "bg-[#FF5910] font-extrabold text-[#0B1730]"
                  : "bg-[#14223F] font-semibold text-slate-200 active:bg-[#1b2d52]"
              }`}
            >
              {t.label}
              {typeof n === "number" && (
                <span
                  className={`rounded-full px-2 py-px text-[13px] ${
                    active ? "bg-[#0B1730] text-white" : "bg-white/10 text-slate-200"
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error ? (
        <div role="alert" className="space-y-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-4">
          <p className="text-[14px] text-red-100">{error}</p>
          <button
            type="button"
            onClick={load}
            className="min-h-11 rounded-xl border border-white/25 px-4 text-[14px] font-bold text-white"
          >
            Try again
          </button>
        </div>
      ) : loading && list.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-slate-300">Loading…</p>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#14223F] p-5 text-[14px] leading-relaxed text-slate-300">
          {EMPTY[tab]}
        </p>
      ) : tab === "published" ? (
        <ul className="space-y-3">
          {published.map((p) => (
            <li key={p.id} className="space-y-2.5 rounded-2xl border border-white/10 bg-[#14223F] p-3">
              {p.featured_image_url ? (
                <img src={p.featured_image_url} alt="" loading="lazy" className="h-32 w-full rounded-xl object-cover" />
              ) : (
                <div className="flex h-24 w-full items-center justify-center rounded-xl bg-[#1b2d52] text-slate-400">
                  <ImageIcon className="h-7 w-7" />
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-extrabold tracking-wider text-[#FF9A6B]">{draftStamp(p.at)}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                    p.live ? "bg-emerald-800 text-emerald-100" : "bg-amber-700/80 text-amber-100"
                  }`}
                >
                  {p.live ? "Live" : "Scheduled"}
                </span>
              </div>
              <h2 className="!text-[20px] !font-extrabold !leading-tight">{p.title}</h2>
              <div className={`grid gap-1.5 ${p.live ? "grid-cols-[1.2fr_1fr_1fr_auto]" : "grid-cols-[1fr_auto]"}`}>
                {p.live && (
                  <button
                    type="button"
                    onClick={() => setSharePost(p)}
                    className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-[#FF5910] text-[15px] font-extrabold text-[#0B1730] active:opacity-90"
                  >
                    <Share2 className="h-[18px] w-[18px]" /> Share
                  </button>
                )}
                <Link to={`/admin/drafts/${p.id}/edit`} className={ghost}>
                  Edit
                </Link>
                {p.live && (
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className={ghost}>
                    Open
                  </a>
                )}
                <button
                  type="button"
                  aria-label={`Delete ${p.title}`}
                  disabled={busyId === p.id}
                  onClick={() => setDeleting(p)}
                  className="flex min-h-12 w-12 items-center justify-center rounded-xl border border-red-400/50 text-red-300 active:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => {
            const waiting = daysWaiting(d.created_at);
            const busy = busyId === d.id;
            return (
              <li
                key={d.id}
                className={`space-y-2.5 rounded-2xl border p-4 ${
                  d.id === selectedId ? "border-[#FF5910] bg-[#1b2d52]" : "border-white/10 bg-[#14223F]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-extrabold tracking-wider text-[#FF9A6B]">
                    {draftStamp(d.created_at)}
                  </span>
                  {tab === "pending" && waiting >= 1 && (
                    <span className="rounded-full border border-[#FF9A6B]/50 px-2.5 py-0.5 text-[12px] font-bold text-[#FFD7C4]">
                      Waiting {waiting} {waiting === 1 ? "day" : "days"}
                    </span>
                  )}
                </div>
                <h2 className="!text-[18px] !font-extrabold !leading-tight">{d.title}</h2>
                {d.summary && <p className="line-clamp-3 text-[14px] leading-snug text-slate-300">{d.summary}</p>}
                <p className="text-[12px] text-slate-300">
                  {d.word_count} words · {d.tags.length} {d.tags.length === 1 ? "tag" : "tags"} · {d.category}
                </p>

                <div className="flex gap-2.5 pt-1">
                  {tab === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(d, "rejected")}
                      className={`${ghost} flex-1`}
                    >
                      Reject
                    </button>
                  )}
                  {tab === "pending" && isPostDraftId(d.id) && (
                    <Link to={`/admin/drafts/${d.id}/edit`} className={`${ghost} flex-1`}>
                      Edit
                    </Link>
                  )}
                  {tab === "rejected" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(d, "pending")}
                      className={`${ghost} flex-1`}
                    >
                      Move back
                    </button>
                  )}
                  <Link
                    to={`/admin/drafts/${d.id}`}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-[16px] font-extrabold ${
                      tab === "pending"
                        ? "flex-[2] bg-[#FF5910] text-[#0B1730] active:opacity-90"
                        : "flex-1 border border-white/25 text-white active:bg-white/10"
                    }`}
                  >
                    {tab === "pending" ? "Read & approve" : "View"}
                    <ChevronRight className="h-[18px] w-[18px]" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "pending" && <p className="text-center text-[13px] text-slate-300">Nothing goes live until you approve it</p>}

      <BlogShareDialog
        open={!!sharePost}
        onOpenChange={(o) => {
          if (!o) setSharePost(null);
        }}
        post={
          sharePost
            ? {
                id: sharePost.postId,
                title: sharePost.title,
                slug: sharePost.slug,
                excerpt: sharePost.excerpt,
                featured_image_url: sharePost.featured_image_url,
              }
            : null
        }
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article for good?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" is removed from the site and can't be brought back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
