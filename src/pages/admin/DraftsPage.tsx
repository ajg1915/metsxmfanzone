import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { forgetDraftsWaiting } from "@/hooks/useDraftsWaiting";
import {
  daysWaiting,
  draftCounts,
  draftStamp,
  listDrafts,
  setDraftStatus,
  type DraftStatus,
  type DraftSummary,
} from "@/lib/draftsApi";

const TABS: { key: DraftStatus; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const EMPTY: Record<DraftStatus, string> = {
  pending: "No drafts waiting. Each morning's article shows up here for you to approve.",
  approved: "Nothing approved yet.",
  rejected: "Nothing rejected.",
};

/** Every draft article in one place: read it, approve it, or reject it before it reaches the site. */
export default function DraftsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<DraftStatus>("pending");
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [counts, setCounts] = useState<Record<DraftStatus, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, c] = await Promise.all([listDrafts(status), draftCounts()]);
      setDrafts(list);
      setCounts(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load drafts");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1>Drafts</h1>
          <p className="text-[13px] text-slate-300">Nothing goes live until you approve it</p>
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

      <div role="tablist" aria-label="Draft status" className="grid grid-cols-3 gap-2">
        {TABS.map((tab) => {
          const active = tab.key === status;
          const n = counts?.[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(tab.key)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[15px] ${
                active
                  ? "bg-[#FF5910] font-extrabold text-[#0B1730]"
                  : "bg-[#14223F] font-semibold text-slate-200 active:bg-[#1b2d52]"
              }`}
            >
              {tab.label}
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
      ) : loading && drafts.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-slate-300">Loading drafts…</p>
      ) : drafts.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#14223F] p-5 text-[14px] leading-relaxed text-slate-300">
          {EMPTY[status]}
        </p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => {
            const waiting = daysWaiting(d.created_at);
            const busy = busyId === d.id;
            return (
              <li key={d.id} className="space-y-2.5 rounded-2xl border border-white/10 bg-[#14223F] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-extrabold tracking-wider text-[#FF9A6B]">
                    {draftStamp(d.created_at)}
                  </span>
                  {status === "pending" && waiting >= 1 && (
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
                  {status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(d, "rejected")}
                      className="min-h-12 flex-1 rounded-xl border border-white/25 text-[15px] font-bold text-white active:bg-white/10 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  )}
                  {status === "rejected" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(d, "pending")}
                      className="min-h-12 flex-1 rounded-xl border border-white/25 text-[15px] font-bold text-white active:bg-white/10 disabled:opacity-50"
                    >
                      Move back
                    </button>
                  )}
                  <Link
                    to={`/admin/drafts/${d.id}`}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-[16px] font-extrabold ${
                      status === "pending"
                        ? "flex-[2] bg-[#FF5910] text-[#0B1730] active:opacity-90"
                        : "flex-1 border border-white/25 text-white active:bg-white/10"
                    }`}
                  >
                    {status === "pending" ? "Read & approve" : "View"}
                    <ChevronRight className="h-[18px] w-[18px]" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
