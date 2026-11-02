import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/metsxmfanzone-logo.png";
import { useGuideItems, findSpot, type GuideItem } from "@/hooks/useGuideItems";

// Phone guide: a 3-step tour shown once to new accounts right after sign-up, plus a
// "Where do I find…?" list. Both can be opened again from the menu ("How to get around").
// Nothing here reads or writes a database: "already seen" lives in this device's storage
// and "new account" comes from the sign-in session's created_at.

export const OPEN_GUIDE_EVENT = "mxfz:open-guide";
const SEEN_KEY = "mxfz_guide_seen";
const NEW_ACCOUNT_DAYS = 3;
const doneKey = (id: string) => `mxfz_guide_done_${id}`;

type Seen = Record<string, string>;
const readSeen = (): Seen => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; } };
const writeSeen = (s: Seen) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch { /* ignore */ } window.dispatchEvent(new Event("mxfz:guide-seen")); };
const markSeen = (it: GuideItem) => writeSeen({ ...readSeen(), [it.id]: it.updated_at });

/** Items the admin flagged "highlight as new" that this device hasn't opened yet. */
export function useUnseenGuideItems(): GuideItem[] {
  const { data } = useGuideItems();
  const [seen, setSeen] = useState<Seen>(() => (typeof window === "undefined" ? {} : readSeen()));
  useEffect(() => {
    const h = () => setSeen(readSeen());
    window.addEventListener("mxfz:guide-seen", h);
    return () => window.removeEventListener("mxfz:guide-seen", h);
  }, []);
  return (data || []).filter((i) => i.highlight_new && seen[i.id] !== i.updated_at);
}


function Tour({ steps, onClose }: { steps: GuideItem[]; onClose: () => void }) {
  const STEPS = steps;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];
  useEffect(() => { if (step.path && step.path !== pathname) navigate(step.path); }, [step.path]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useCallback(() => {
    const el = findSpot(step.section);
    if (!el) { setRect(null); return; }
    if (!el.closest("nav, aside, [data-guide=\"bottom-nav\"]")) el.scrollIntoView({ block: "center" });
    setRect(el.getBoundingClientRect());
  }, [step.section]);

  useLayoutEffect(() => {
    measure();
    // Pages load lazily after a step switches route, so keep looking for the spot for a few seconds.
    let tries = 0;
    const poll = setInterval(() => {
      measure();
      if ((findSpot(step.section) && tries > 3) || ++tries > 24) clearInterval(poll);
    }, 250);
    window.addEventListener("resize", measure);
    return () => { clearInterval(poll); window.removeEventListener("resize", measure); };
  }, [measure]);

  const last = i === STEPS.length - 1;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardStyle: React.CSSProperties = { left: 16, right: 16, maxWidth: 440, marginInline: "auto" };
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
        <p className="mt-2 text-[15px] leading-snug text-white">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={i === 0 ? onClose : () => setI(i - 1)} className="min-h-[44px] px-1 text-sm font-semibold text-[#d6e4f7]">{i === 0 ? "Skip" : "Back"}</button>
          <button type="button" onClick={last ? onClose : () => setI(i + 1)} className="min-h-[44px] rounded-lg bg-primary px-7 font-display text-lg uppercase tracking-[0.1em] text-primary-foreground">{last ? "Got it" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}

function selectorFor(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const g = el.closest<HTMLElement>("[data-guide]");
  if (g === el) return `[data-guide="${el.getAttribute("data-guide")}"]`;
  const label = el.getAttribute("aria-label");
  if (label) return `${el.tagName.toLowerCase()}[aria-label="${label.replace(/"/g, '\\"')}"]`;
  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body && parts.length < 5) {
    if (cur.id) { parts.unshift(`#${CSS.escape(cur.id)}`); break; }
    const parent: HTMLElement | null = cur.parentElement;
    const tag = cur.tagName.toLowerCase();
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === cur!.tagName) : [];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    cur = parent;
  }
  return parts.join(" > ");
}

/** Admin helper: open any page with ?guidepick=1, tap a button or section, copy its selector. */
function Picker() {
  const [sel, setSel] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let last: HTMLElement | null = null;
    const clearOutline = () => { if (last) last.style.outline = ""; };
    const over = (e: Event) => { const t = e.target as HTMLElement; if (t.closest("[data-guide-picker]")) return; clearOutline(); last = t; t.style.outline = "3px solid #ff4400"; };
    const click = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-guide-picker]")) return;
      e.preventDefault(); e.stopPropagation();
      setSel(selectorFor(t)); setCopied(false);
    };
    document.addEventListener("pointerover", over, true);
    document.addEventListener("click", click, true);
    return () => { clearOutline(); document.removeEventListener("pointerover", over, true); document.removeEventListener("click", click, true); };
  }, []);
  return (
    <div data-guide-picker className="fixed inset-x-3 bottom-3 z-[200] rounded-xl border-2 border-primary bg-secondary p-3 text-white shadow-2xl">
      <p className="font-display text-[15px] uppercase tracking-[0.12em] text-[#ffa57a]">Guide picker</p>
      <p className="text-sm">{sel ? "Selected. Copy it, then paste it in Admin → Mobile Guide → Spot → Custom." : "Tap the button or section you want to highlight."}</p>
      {sel && (
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-black/30 px-2 py-1 text-xs">{sel}</code>
          <button type="button" className="rounded-lg bg-primary px-3 py-2 font-display text-base uppercase text-primary-foreground"
            onClick={() => { navigator.clipboard?.writeText(sel).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
    </div>
  );
}

function jumpTo(section: string) {
  let tries = 0;
  const go = () => {
    const el = findSpot(section);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.setAttribute("data-guide-pulse", "1");
      setTimeout(() => el.removeAttribute("data-guide-pulse"), 2600);
    } else if (tries++ < 20) setTimeout(go, 250); // lazy sections may still be loading
  };
  setTimeout(go, 350);
}

export default function MobileGuide() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: items = [], device } = useGuideItems();
  const unseen = useUnseenGuideItems();
  const { search } = useLocation();
  const picking = new URLSearchParams(search).get("guidepick") === "1";
  const [tour, setTour] = useState(false);
  const [list, setList] = useState(false);

  const steps = items.filter((i) => i.kind === "tour");
  const finds = items.filter((i) => i.kind === "find");
  const suggested = finds.filter((i) => i.suggested);
  const rest = finds.filter((i) => !i.suggested);

  // Auto tour: phones only, new account (created in the last few days), once per user on this device.
  useEffect(() => {
    if (!user?.id || !user.created_at || !steps.length) return;
    if (device === "tv" || pathname !== "/") return;
    const age = Date.now() - new Date(user.created_at).getTime();
    if (age > NEW_ACCOUNT_DAYS * 86_400_000) return;
    try { if (localStorage.getItem(doneKey(user.id))) return; } catch { return; }
    const t = setTimeout(() => setTour(true), 1200);
    return () => clearTimeout(t);
  }, [user?.id, user?.created_at, pathname, steps.length, device]);

  // Open from the menu.
  useEffect(() => {
    const h = (e: Event) => {
      const mode = (e as CustomEvent<string>).detail;
      if (mode === "tour") { if (location.pathname !== "/") navigate("/"); setTimeout(() => setTour(true), 400); }
      else setList(true);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, h);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, h);
  }, [navigate]);

  // Glow on anything new, even for people who already know the site. Clears when they tap it.
  const unseenKey = unseen.map((u) => u.id + u.updated_at).join("|");
  useEffect(() => {
    if (!unseen.length) return;
    const cleanups: (() => void)[] = [];
    const marked = new Set<Element>();
    let tries = 0;
    const attach = () => {
      unseen.forEach((it) => {
        if (!it.section) return;
        const el = findSpot(it.section);
        if (!el || marked.has(el)) return;
        marked.add(el);
        el.setAttribute("data-guide-new", "1");
        const clear = () => { el.removeAttribute("data-guide-new"); markSeen(it); };
        el.addEventListener("pointerdown", clear, { once: true });
        cleanups.push(() => { el.removeAttribute("data-guide-new"); el.removeEventListener("pointerdown", clear); });
      });
      if (tries++ < 12) timer = setTimeout(attach, 500);
    };
    let timer = setTimeout(attach, 300);
    return () => { clearTimeout(timer); cleanups.forEach((c) => c()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenKey, pathname]);

  // The menu button glows while anything new is waiting.
  useEffect(() => {
    const els = ['menu-button', 'guide-button'].map((k) => findSpot(k)).filter(Boolean) as HTMLElement[];
    els.forEach((el) => { if (unseen.length) el.setAttribute("data-guide-new", "1"); else el.removeAttribute("data-guide-new"); });
  }, [unseen.length, pathname, device]);

  const closeTour = () => {
    setTour(false);
    if (user?.id) { try { localStorage.setItem(doneKey(user.id), "1"); } catch { /* storage blocked */ } }
  };

  const open = (it: GuideItem) => {
    markSeen(it);
    setList(false);
    const path = it.path || "/";
    if (/^https?:\/\//i.test(path)) { window.open(path, "_blank", "noopener,noreferrer"); return; }
    if (location.pathname !== path) navigate(path);
    if (it.section) jumpTo(it.section);
  };

  const Row = ({ it }: { it: GuideItem }) => {
    const isNew = unseen.some((u) => u.id === it.id);
    return (
      <li>
        <button type="button" onClick={() => open(it)} className="flex min-h-[52px] w-full items-center gap-3 text-left">
          <span className="flex-1 text-[15px] font-bold text-foreground">
            {it.title}
            {isNew && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 font-display text-[12px] tracking-wider text-primary-foreground">NEW</span>}
          </span>
          {it.where_label && <span className="rounded-full bg-secondary px-3 py-1 font-display text-[13px] tracking-[0.08em] text-white">{it.where_label}</span>}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </li>
    );
  };

  return (
    <>
      {picking && <Picker />}
      {tour && steps.length > 0 && <Tour steps={steps} onClose={closeTour} />}
      <Dialog open={list} onOpenChange={setList}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-md gap-0 overflow-y-auto rounded-2xl border-primary/50 bg-background p-0">
          <div className="flex items-center gap-3 border-b border-primary/40 px-4 py-3">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <DialogTitle className="font-display text-[26px] uppercase tracking-wide text-foreground">Where do I find…?</DialogTitle>
          </div>
          <DialogDescription className="sr-only">Tap a row to jump straight there.</DialogDescription>
          {suggested.length > 0 && (
            <>
              <p className="px-4 pt-3 font-display text-[15px] uppercase tracking-[0.14em] text-primary">Suggested</p>
              <ul className="divide-y divide-primary/20 px-4">{suggested.map((it) => <Row key={it.id} it={it} />)}</ul>
              <p className="px-4 pt-3 font-display text-[15px] uppercase tracking-[0.14em] text-muted-foreground">Everything</p>
            </>
          )}
          <ul className="divide-y divide-primary/20 px-4">{rest.map((it) => <Row key={it.id} it={it} />)}</ul>
          <div className="border-t border-primary/40 p-4">
            <button type="button" onClick={() => { setList(false); window.dispatchEvent(new CustomEvent(OPEN_GUIDE_EVENT, { detail: "tour" })); }} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-display text-lg uppercase tracking-[0.1em] text-primary-foreground">
              <HelpCircle className="h-5 w-5" /> Replay the tour
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
