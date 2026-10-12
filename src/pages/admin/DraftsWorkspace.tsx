import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DraftsPage from "./DraftsPage";
import DraftReview from "./DraftReview";

const DESKTOP_QUERY = "(min-width: 1024px)";

const useIsDesktop = () => {
  const [desktop, setDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
};

/**
 * Phone and tablet: the list page, and a full-screen review page for one draft.
 * PC (1024px and wider): one workspace, list on the left, the open draft on the right.
 */
export default function DraftsWorkspace() {
  const { id } = useParams();
  const desktop = useIsDesktop();
  const [refreshKey, setRefreshKey] = useState(0);

  if (!desktop) return id ? <DraftReview /> : <DraftsPage />;

  return (
    <div className="grid w-full grid-cols-[400px_minmax(0,1fr)] items-start gap-6">
      <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
        <DraftsPage compact selectedId={id} refreshKey={refreshKey} />
      </div>
      <section aria-label="Draft review" className="min-w-0">
        {id ? (
          <DraftReview key={id} embedded draftId={id} onChanged={() => setRefreshKey((k) => k + 1)} />
        ) : (
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-[#14223F]/60 p-8 text-center">
            <p className="max-w-xs text-[15px] leading-relaxed text-slate-300">
              Pick a draft on the left to read it, edit it, and approve or reject it here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
