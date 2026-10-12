import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Monitor, Smartphone, Tablet, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/metsxmfanzone-logo.png";

const OPT_IN_KEY = "desktop_opt_in";
export const WELCOME_GATE_SETTING_KEY = "desktop_welcome_gate";

export type GateConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
  note: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
};

export const GATE_DEFAULTS: GateConfig = {
  enabled: true,
  title: "Mobile & Tablet Only",
  subtitle:
    "MetsXMFanZone is now optimized exclusively for mobile and tablet devices. For the best experience, please open this site on your phone or tablet.",
  note: "Desktop is no longer officially supported, but you can continue anyway.",
  primaryLabel: "Continue to Home",
  primaryUrl: "/",
  secondaryLabel: "Login",
  secondaryUrl: "/auth",
};

/**
 * Desktop block gate. Site is now mobile/tablet-first (<1024px).
 * Desktop users (>=1024px) see a blocking screen with an option to continue anyway.
 */
export const DesktopWelcomeGate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [cfg, setCfg] = useState<GateConfig>(GATE_DEFAULTS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", WELCOME_GATE_SETTING_KEY)
        .maybeSingle();
      if (data?.setting_value) {
        setCfg({ ...GATE_DEFAULTS, ...(data.setting_value as Partial<GateConfig>) });
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!cfg.enabled) return;
    const forcePreview = window.location.search.includes("preview_gate=1");
    // Persistent opt-in — once user chooses desktop, don't nag again
    if (!forcePreview && localStorage.getItem(OPT_IN_KEY) === "1") return;
    const host = window.location.hostname;
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    const isDevOrEmbedded =
      inIframe ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (!forcePreview && isDevOrEmbedded) return;
    // Allow tablets (<1024px). Only block true desktop.
    if (!forcePreview && window.innerWidth < 1024) return;
    if (window.location.search.includes("tv=true")) return;
    // Never block auth, admin, or publicly shared article routes.
    // Blog pages must remain directly readable on desktop and from social links.
    const path = location.pathname;
    if (
      !forcePreview &&
      (path.startsWith("/admin") ||
        path.startsWith("/auth") ||
        path.startsWith("/blog") ||
        path.startsWith("/og-blog") ||
        path.startsWith("/writer-auth") ||
        path.startsWith("/reset-password"))
    )
      return;

    setShow(true);
  }, [location.pathname, cfg.enabled]);

  // Close the gate and remember the choice so it does not come back
  const dismiss = () => {
    try {
      localStorage.setItem(OPT_IN_KEY, "1");
    } catch {
      /* private mode: just close it for this visit */
    }
    setShow(false);
  };

  // Both buttons close the gate; if a page is set for the button, go there too
  const choose = (url: string) => {
    dismiss();
    const target = (url || "").trim();
    if (target && target !== location.pathname) {
      if (/^https?:\/\//i.test(target)) window.location.href = target;
      else navigate(target);
    }
  };

  // Escape closes it
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={cfg.title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/20 p-8"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex justify-center mb-4">
          <img
            src={logo}
            alt="MetsXMFanZone"
            className="h-16 w-auto drop-shadow-[0_0_24px_hsl(var(--primary)/0.5)]"
          />
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30">
            <Tablet className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xl text-muted-foreground">/</div>
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border opacity-50">
            <Monitor className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-foreground mb-2">
          {cfg.title}
        </h2>
        <p className="text-center text-muted-foreground mb-6 text-sm">
          {cfg.subtitle}
        </p>
        {cfg.note && (
          <div className="rounded-lg bg-muted/30 border border-border p-3 mb-6 text-center">
            <p className="text-xs text-muted-foreground">{cfg.note}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button onClick={() => choose(cfg.primaryUrl)} className="w-full bg-primary hover:bg-primary/90">
            {cfg.primaryLabel}
          </Button>
          <Button onClick={() => choose(cfg.secondaryUrl)} variant="outline" className="w-full">
            {cfg.secondaryLabel}
          </Button>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy site link to open on your phone"}
        </button>
      </div>
    </div>
  );
};

export default DesktopWelcomeGate;
