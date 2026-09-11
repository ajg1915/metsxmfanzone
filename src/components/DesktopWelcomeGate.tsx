import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Monitor, Smartphone, Tablet, Copy, Check } from "lucide-react";
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
  primaryLabel: "Copy Site Link",
  primaryUrl: "",
  secondaryLabel: "Continue on Desktop",
  secondaryUrl: "",
};

/**
 * Desktop block gate. Site is now mobile/tablet-first (<1024px).
 * Desktop users (>=1024px) see a blocking screen with an option to continue anyway.
 */
export const DesktopWelcomeGate = () => {
  const location = useLocation();
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
    const isLovablePreview =
      inIframe ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.includes("id-preview--") ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app") ||
      window.location.search.includes("__lovable_token=");
    if (!forcePreview && isLovablePreview) return;
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

  const continueOnDesktop = () => {
    localStorage.setItem(OPT_IN_KEY, "1");
    setShow(false);
  };

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/20 p-8">
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
          <Button onClick={copyLink} variant="outline" className="w-full">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                {cfg.primaryLabel}
              </>
            )}
          </Button>
          <Button
            onClick={continueOnDesktop}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <Monitor className="w-4 h-4 mr-2" />
            {cfg.secondaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DesktopWelcomeGate;
