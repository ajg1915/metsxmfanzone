import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

const MESSAGES = [
  "Thanks for watching with us! Let's Go Mets!",
  "Appreciate you tuning in. See you at the next stream!",
  "Thanks for being part of the MetsXMFanZone family.",
];

const STREAM_PATHS = ["/live", "/metsxmfanzone", "/mlb-network", "/espn-network", "/apple-tv", "/prime-video", "/peacock", "/pix11-network", "/spring-training-live", "/community-podcast"];
const NEVER_ON = ["/admin", "/tv", "/auth", "/writer", "/dashboard"];
const MIN_WATCH_MS = 60_000;       // only thank people who actually watched
const COOLDOWN_MS = 30 * 60_000;   // at most once every 30 minutes on a device
const SHOW_MS = 8_000;             // goes away by itself
const COOLDOWN_KEY = "mxfz_stream_thanks_at";

const onStream = (p: string) => STREAM_PATHS.some((s) => p === s || p.startsWith(s + "/"));

/** A small thank-you card (not a blocking pop-up) after someone leaves a stream they watched for a minute or more. */
export function StreamExitDialog() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const enteredAt = useRef<number | null>(null);
  const lastStream = useRef<string>("/metsxmfanzone");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (onStream(pathname)) {
      if (enteredAt.current === null) enteredAt.current = Date.now();
      lastStream.current = pathname;
      setMsg(null);
      return;
    }
    // Left a stream page.
    const started = enteredAt.current;
    enteredAt.current = null;
    if (started === null || Date.now() - started < MIN_WATCH_MS) return;
    if (NEVER_ON.some((p) => pathname.startsWith(p))) return;
    if (document.body.hasAttribute("data-guide-tour")) return;
    try {
      const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
      if (Date.now() - last < COOLDOWN_MS) return;
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    } catch { /* storage blocked: still show it this once */ }
    setMsg(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  }, [pathname]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-[88px] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/50 bg-card/95 p-3 shadow-2xl backdrop-blur md:bottom-6 md:left-auto md:right-6 md:mx-0">
      <img src={metsLogo} alt="" className="h-10 w-10 shrink-0 object-contain" />
      <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{msg}</p>
      <button type="button" onClick={() => { setMsg(null); navigate(lastStream.current); }} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">Back to stream</button>
      <button type="button" onClick={() => setMsg(null)} aria-label="Close" className="shrink-0 p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
