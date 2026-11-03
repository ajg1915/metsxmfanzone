import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchLivePingEnabled } from "@/lib/liveEventPing";
import { detectDevice, detectInstalledApp } from "@/hooks/useGuideItems";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import logo from "@/assets/metsxmfanzone-logo.png";

const SEEN_KEY = "mxfz_live_popup_seen";
type Live = { id: string; title: string | null };

const readSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; } };
const writeSeen = (ids: string[]) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-30))); } catch { /* storage blocked */ } };

/** Pops up on phones, tablets and the installed app when a live game event starts (if the admin switch is on). Once per event per device. */
export default function LiveEventPopup() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [live, setLive] = useState<Live | null>(null);
  const busy = useRef(false);
  const blocked = pathname.startsWith("/admin") || pathname.startsWith("/tv") || pathname.startsWith("/auth") || pathname.startsWith("/metsxmfanzone");

  useEffect(() => {
    const device = detectDevice();
    if (device === "tv" || (device === "desktop" && !detectInstalledApp())) return;
    let alive = true;
    const check = async () => {
      if (busy.current || !alive || document.visibilityState === "hidden") return;
      if (document.body.hasAttribute("data-guide-tour")) return; // don't talk over the tour
      busy.current = true;
      try {
        if (!(await fetchLivePingEnabled())) return;
        const { data } = await supabase.from("live_streams").select("id, title").eq("status", "live").eq("published", true).order("updated_at", { ascending: false }).limit(1);
        const s = data?.[0] as Live | undefined;
        if (s && alive && !readSeen().includes(s.id)) setLive((cur) => cur ?? s);
      } catch { /* try again next time */ } finally { busy.current = false; }
    };
    const first = setTimeout(check, 4000);
    const timer = setInterval(check, 45_000);
    document.addEventListener("visibilitychange", check);
    return () => { alive = false; clearTimeout(first); clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);

  const close = () => { if (live) writeSeen([...readSeen(), live.id]); setLive(null); };

  return (
    <Dialog open={!!live && !blocked} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border-2 border-primary bg-background p-5 text-center">
        <img src={logo} alt="" className="mx-auto h-14 w-auto object-contain" />
        <span className="mx-auto inline-flex items-center gap-2 rounded bg-red-700 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE NOW
        </span>
        <DialogTitle className="font-display text-[30px] uppercase leading-none tracking-wide text-foreground">{live?.title || "A live game event is on"}</DialogTitle>
        <DialogDescription className="text-[15px] text-muted-foreground">MetsXMFanZone is live right now. Tap to watch.</DialogDescription>
        <button type="button" onClick={() => { close(); navigate("/metsxmfanzone"); }} className="h-12 w-full rounded-xl bg-primary font-display text-xl uppercase tracking-[0.1em] text-primary-foreground">Watch now</button>
        <button type="button" onClick={close} className="min-h-[44px] text-sm font-semibold text-muted-foreground">Not now</button>
      </DialogContent>
    </Dialog>
  );
}
