import { useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, HelpCircle, X } from "lucide-react";
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
const STEP_SECONDS = 5;
const doneKey = (id: string) => `mxfz_guide_done_${id}`;
const GUEST_KEY = "mxfz_guide_done_guest";

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
  useEffect(() => { document.body.setAttribute("data-guide-tour", "1"); return () => document.body.removeAttribute("data-guide-tour"); }, []);
  const menuStep = !!step.section?.startsWith("menu-") && step.section !== "menu-button";
  useEffect(() => { window.dispatchEvent(new CustomEvent("mxfz:menu", { detail: menuStep })); }, [menuStep]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("mxfz:menu", { detail: false })); }, []);
  useEffect(() => { if (step.path && step.path !== pathname) navigate(step.path); }, [step.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find the spot, scroll it to the middle of the screen, and keep the glow stuck to it even while
  // lazy sections load and change the page height (that is what made some sections glow in the wrong place).
  useLayoutEffect(() => {
    let scrolls = 0;
    let observed: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    const measure = (allowScroll: boolean) => {
      const el = findSpot(step.section);
      const r = el?.getBoundingClientRect();
      if (!el || !r || r.width < 8 || r.height < 8) { setRect(null); return; }
      if (observed !== el) {
        ro?.disconnect();
        observed = el;
        ro = new ResizeObserver(() => measure(true));
        ro.observe(el);
      }
      if (allowScroll && scrolls < 4 && !el.closest('nav:not([aria-label="Mobile navigation"]), aside, [data-guide="bottom-nav"]')) {
        const mid = r.top + r.height / 2;
        if (Math.abs(mid - window.innerHeight / 2) > 40) { scrolls++; el.scrollIntoView({ block: "center" }); }
      }
      setRect(el.getBoundingClientRect());
    };
    measure(true);
    // Pages and lazy sections load after a step switches route, so keep looking for several seconds.
    let tries = 0;
    const poll = setInterval(() => { measure(true); if (++tries > 48) clearInterval(poll); }, 250);
    const onMove = () => measure(false);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { clearInterval(poll); ro?.disconnect(); window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [step.section]);

  const last = i === STEPS.length - 1;
  // Each step moves on by itself after 5 seconds. The last one stays until the person taps End tour.
  useEffect(() => {
    if (last) return;
    const t = setTimeout(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), STEP_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [i, last, STEPS.length]);
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardStyle: React.CSSProperties = { left: 16, right: 16, maxWidth: 440, marginInline: "auto" };
  const CARD_H = 230;
  // "Above"/"below" follow the spot but flip if there is no room; top/middle/bottom stay put on screen.
  let place = step.place;
  if (rect && place === "below" && rect.bottom + 16 + CARD_H > vh) place = "above";
  else if (rect && place === "above" && rect.top - 16 - CARD_H < 0) place = "below";
  if (place === "top") cardStyle.top = 76;
  else if (place === "bottom") cardStyle.bottom = 84;
  else if (place === "center") { cardStyle.top = "50%"; cardStyle.transform = "translateY(-50%)"; }
  else if (rect && place === "above") cardStyle.bottom = Math.max(16, vh - rect.top + 16);
  else if (rect && place === "below") cardStyle.top = Math.min(vh - CARD_H, rect.bottom + 16);
  else { cardStyle.top = "50%"; cardStyle.transform = "translateY(-50%)"; }

  return (
    <div className="fixed inset-0 z-[100]" style={{ pointerEvents: "auto" }} role="dialog" aria-modal="true" aria-label={`Guide, step ${i + 1} of ${STEPS.length}`}>
      {rect ? (
        <>
          <div className="pointer-events-none fixed rounded-xl border-[3px] border-primary shadow-[0_0_0_2000px_rgba(3,10,20,0.82)]"
            style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />
          <div className="guide-glow-ring pointer-events-none fixed rounded-xl"
            style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />
        </>
      ) : (
        <div className="fixed inset-0 bg-[rgba(3,10,20,0.82)]" />
      )}
      <div className="fixed rounded-2xl border-2 border-primary bg-secondary p-[18px] text-white shadow-2xl" style={cardStyle}>
        {!last && (
          <button type="button" onClick={onClose} aria-label="Close tour" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
        <p className="flex items-center gap-2 font-display text-[15px] tracking-[0.16em] text-[#ffa57a]">
          <img src={logo} alt="" className="h-6 w-6 object-contain" /> STEP {i + 1} OF {STEPS.length}
        </p>
        <h2 className="mt-1 font-display text-[30px] uppercase leading-none tracking-wide text-white">{step.title}</h2>
        <p className="mt-2 text-[15px] leading-snug text-white">{step.body}</p>
        {!last && <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/20" aria-hidden="true"><div key={i} className="h-full rounded-full bg-primary" style={{ animation: `guideTimer ${STEP_SECONDS}s linear forwards` }} /></div>}
        {/* End tour only appears on the very last step. */}
        {last && (
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-lg bg-primary px-7 font-display text-lg uppercase tracking-[0.1em] text-primary-foreground">End tour</button>
          </div>
        )}
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: items = [], device } = useGuideItems();
  const unseen = useUnseenGuideItems();
  const { search } = useLocation();
  const picking = new URLSearchParams(search).get("guidepick") === "1";
  // "full" = the whole tour (new sign-ups, or replayed from the menu); "new" = only what the admin just flagged as NEW.
  const [tour, setTour] = useState<{ steps: GuideItem[]; mode: "full" | "new" } | null>(null);
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
    const t = setTimeout(() => setTour((cur) => cur ?? { steps, mode: "full" }), 1200);
    return () => clearTimeout(t);
  }, [user?.id, user?.created_at, pathname, steps.length, device]);

  // Visitors who aren't signed in get the tour once per device when they land on the home page.
  useEffect(() => {
    if (authLoading || user || !steps.length || picking) return;
    if (device === "tv" || pathname !== "/") return;
    try { if (localStorage.getItem(GUEST_KEY)) return; } catch { return; }
    const t = setTimeout(() => setTour((cur) => cur ?? { steps, mode: "full" }), 2500);
    return () => clearTimeout(t);
  }, [authLoading, user, pathname, steps.length, device, picking]);

  // Open from the menu.
  useEffect(() => {
    const h = (e: Event) => {
      const mode = (e as CustomEvent<string>).detail;
      if (mode === "tour") { if (location.pathname !== "/") navigate("/"); setTimeout(() => setTour({ steps, mode: "full" }), 400); }
      else setList(true);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, h);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, h);
  }, [navigate, steps]);

  // When something new is flagged, start a short tour of just those items on the person's next visit (once per item per device).
  const unseenSig = unseen.map((u) => u.id + u.updated_at).join("|");
  useEffect(() => {
    if (!unseen.length || tour || picking || device === "tv" || pathname !== "/") return;
    const t = setTimeout(() => setTour((cur) => cur ?? {
      mode: "new",
      steps: unseen.map((u) => ({ ...u, kind: "tour" as const, body: u.body || u.where_label || "This is new. Take a look.", path: u.kind === "tour" ? u.path : null })),
    }), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenSig, tour, pathname, device, picking]);

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
    // Showing people the new things counts as seeing them, so the tour doesn't start again and the glow clears.
    tour?.steps.forEach((u) => markSeen(u));
    setTour(null);
    // Always finish back on the home screen (a step may have opened another page, like Install).
    window.dispatchEvent(new CustomEvent("mxfz:menu", { detail: false }));
    if (location.pathname !== "/") navigate("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (tour?.mode === "full") { try { localStorage.setItem(user?.id ? doneKey(user.id) : GUEST_KEY, "1"); } catch { /* storage blocked */ } }
  };

  const open = (it: GuideItem) => {
    markSeen(it);
    setList(false);
    if (it.section?.startsWith("menu-") && it.section !== "menu-button") window.dispatchEvent(new CustomEvent("mxfz:menu", { detail: true }));
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
            {it.body && <span className="mt-0.5 block text-[13px] font-normal leading-snug text-muted-foreground">{it.body}</span>}
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
      {tour && tour.steps.length > 0 && <Tour steps={tour.steps} onClose={closeTour} />}
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
