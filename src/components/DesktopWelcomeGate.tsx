import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Monitor, Smartphone, Home, LogIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/metsxmfanzone-logo.png";

const STORAGE_KEY = "desktop_welcome_gate_dismissed";
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
  title: "Best viewed on mobile",
  subtitle:
    "MetsXMFanZone is optimized for the mobile experience. For the best experience, please open this site on your phone.",
  note: "Prefer to continue on desktop? Choose an option below.",
  primaryLabel: "Continue to Home",
  primaryUrl: "/",
  secondaryLabel: "Login",
  secondaryUrl: "/auth",
};

/**
 * Desktop welcome gate shown on the homepage for all viewers (>=1024px).
 * Content is configured by admins in /admin/welcome-screen.
 */
export const DesktopWelcomeGate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [cfg, setCfg] = useState<GateConfig>(GATE_DEFAULTS);

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
    if (location.pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (!cfg.enabled) return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    const host = window.location.hostname;
    const isLovablePreview =
      host.includes("id-preview--") ||
      host.endsWith(".lovableproject.com") ||
      window.location.search.includes("__lovable_token=");
    if (isLovablePreview) return;
    if (window.innerWidth < 1024) return;
    if (window.location.search.includes("tv=true")) return;
    setShow(true);
  }, [location.pathname, cfg.enabled]);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const go = (url: string) => {
    dismiss();
    if (url.startsWith("http")) {
      window.location.href = url;
    } else {
      navigate(url);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/20 p-8">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center mb-4">
          <img
            src={logo}
            alt="MetsXMFanZone"
            className="h-16 w-auto drop-shadow-[0_0_24px_hsl(var(--primary)/0.5)]"
          />
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xl text-muted-foreground">+</div>
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
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
          <Button onClick={() => go(cfg.primaryUrl)} variant="outline" className="w-full">
            <Home className="w-4 h-4 mr-2" />
            {cfg.primaryLabel}
          </Button>
          <Button
            onClick={() => go(cfg.secondaryUrl)}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <LogIn className="w-4 h-4 mr-2" />
            {cfg.secondaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DesktopWelcomeGate;
