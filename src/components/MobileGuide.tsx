import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/metsxmfanzone-logo.png";

// Phone guide: a 3-step tour shown once to new accounts right after sign-up, plus a
// "Where do I find…?" list. Both can be opened again from the menu ("How to get around").
// Nothing here reads or writes a database: "already seen" lives in this device's storage
// and "new account" comes from the sign-in session's created_at.

export const OPEN_GUIDE_EVENT = "mxfz:open-guide";
const NEW_ACCOUNT_DAYS = 3;
const doneKey = (id: string) => `mxfz_guide_done_${id}`;

type Step = { target: string; title: string; text: string; place: "above" | "below" | "center" };
const STEPS: Step[] = [
  { target: "bottom-nav", place: "above", title: "Your 5 main tabs", text: "Home, Watch Live, Blog, Games and Feed are always at the bottom. Tap one from any page." },
  { target: "menu-button", place: "below", title: "Everything else is in the menu", text: "Tap the three lines. Schedule, Scores, Game Center, Picks, Podcast, Highlights and your account are all in there." },
  { target: "fa-row", place: "below", title: "Swipe each row sideways", text: "FA is free agency: tap Trades, Signings or Radar, then swipe the cards. Spring Training, Live Streams and the rest work the same way." },
];

const FIND: { what: string; where: string; path: string }[] = [
  { what: "Watch a live game", where: "Watch Live tab", path: "/metsxmfanzone" },
  { what: "Today's scores", where: "Home · scores strip", path: "/" },
  { what: "Full schedule", where: "Menu › Schedule", path: "/mets-schedule-2027" },
  { what: "Spring Training games", where: "Home · Spring Training", path: "/spring-training-live" },
  { what: "Trades, signings, rumors", where: "Home · FA", path: "/" },
  { what: "Articles", where: "Blog tab", path: "/blog" },
  { what: "Highlights", where: "Menu › Highlights", path: "/video-gallery" },
  { what: "Picks and predictions", where: "Menu › Picks", path: "/picks" },
  { what: "The podcast", where: "Menu › Podcast", path: "/podcast" },
  { what: "Fan posts and community", where: "Feed tab", path: "/community" },
  { what: "My account and plan", where: "Menu › Dashboard", path: "/dashboard" },
  { what: "Install the app", where: "Menu › Get the app", path: "/install" },
];

const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
    if (!el) { setRect(null); return; }
    if (step.target === "fa-row") el.scrollIntoView({ block: "center" });
    setRect(el.getBoundingClientRect());
  }, [step.target]);

  useLayoutEffect(() => {
    measure();
    const t = setTimeout(measure, 350); // after any scroll settles
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [measure]);

  const last = i === STEPS.length - 1;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardStyle: React.CSSProperties = { left: 16, right: 16 };
  if (rect && step.place === "above") cardStyle.bottom = Math.max(16, vh - rect.top + 16);
  else if (rect && step.place === "below") cardStyle.top = Math.min(vh - 240, rect.bottom + 16);
  else cardStyle.top = "30%";

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={`Guide, step ${i + 1} of ${STEPS.length}`}>
      {rect ? (
        <div className="pointer-events-none fixed rounded-xl border-[3px] border-primary shadow-[0_0_0_2000px_rgba(3,10,20,0.82)]"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />
      ) : (
        <div className="fixed inset-0 bg-[rgba(3,10,20,0.82)]" />
      )}
      <div className="fixed rounded-2xl border-2 border-primary bg-secondary p-[18px] text-white shadow-2xl" style={cardStyle}>
        <p className="flex items-center gap-2 font-display text-[15px] tracking-[0.16em] text-[#ffa57a]">
          <img src={logo} alt="" className="h-6 w-6 object-contain" /> STEP {i + 1} OF {STEPS.length}
        </p>
        <h2 className="mt-1 font-display text-[30px] uppercase leading-none tracking-wide text-white">{step.title}</h2>
        <p className="mt-2 text-[15px] leading-snug text-white">{step.text}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={i === 0 ? onClose : () => setI(i - 1)} className="min-h-[44px] px-1 text-sm font-semibold text-[#d6e4f7]">{i === 0 ? "Skip" : "Back"}</button>
          <button type="button" onClick={last ? onClose : () => setI(i + 1)} className="min-h-[44px] rounded-lg bg-primary px-7 font-display text-lg uppercase tracking-[0.1em] text-primary-foreground">{last ? "Got it" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}

export default function MobileGuide() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [tour, setTour] = useState(false);
  const [list, setList] = useState(false);

  // Auto tour: phones only, new account (created in the last few days), once per device.
  useEffect(() => {
    if (!user?.id || !user.created_at) return;
    if (!isPhone() || pathname !== "/") return;
    const age = Date.now() - new Date(user.created_at).getTime();
    if (age > NEW_ACCOUNT_DAYS * 86_400_000) return;
    try { if (localStorage.getItem(doneKey(user.id))) return; } catch { return; }
    const t = setTimeout(() => setTour(true), 1200); // let the home page paint first
    return () => clearTimeout(t);
  }, [user?.id, user?.created_at, pathname]);

  // Opened from the menu.
  useEffect(() => {
    const h = (e: Event) => {
      const mode = (e as CustomEvent<string>).detail;
      if (mode === "tour") { if (location.pathname !== "/") navigate("/"); setTimeout(() => setTour(true), 400); }
      else setList(true);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, h);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, h);
  }, [navigate]);

  const closeTour = () => {
    setTour(false);
    if (user?.id) { try { localStorage.setItem(doneKey(user.id), "1"); } catch { /* storage blocked: tour may show again */ } }
  };

  return (
    <>
      {tour && <Tour onClose={closeTour} />}
      <Dialog open={list} onOpenChange={setList}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-md gap-0 overflow-y-auto rounded-2xl border-primary/50 bg-background p-0">
          <div className="flex items-center gap-3 border-b border-primary/40 px-4 py-3">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <DialogTitle className="font-display text-[26px] uppercase tracking-wide text-foreground">Where do I find…?</DialogTitle>
          </div>
          <DialogDescription className="sr-only">Tap a row to go there.</DialogDescription>
          <ul className="divide-y divide-primary/20 px-4">
            {FIND.map((r) => (
              <li key={r.what}>
                <button type="button" onClick={() => { setList(false); navigate(r.path); }} className="flex min-h-[52px] w-full items-center gap-3 text-left">
                  <span className="flex-1 text-[15px] font-bold text-foreground">{r.what}</span>
                  <span className="rounded-full bg-secondary px-3 py-1 font-display text-[13px] tracking-[0.08em] text-white">{r.where}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-primary/40 p-4">
            <button type="button" onClick={() => { setList(false); window.dispatchEvent(new CustomEvent(OPEN_GUIDE_EVENT, { detail: "tour" })); }} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-display text-lg uppercase tracking-[0.1em] text-primary-foreground">
              <HelpCircle className="h-5 w-5" /> Replay the 3-step tour
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
