import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Monitor, Smartphone, Home, LogIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "desktop_welcome_gate_dismissed";

/**
 * Shown only on desktop viewports (>=1024px) on the homepage.
 * Suggests mobile view but lets the user continue to Home or Login.
 * Dismissed for the session once interacted with.
 */
export const DesktopWelcomeGate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (location.pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    if (window.innerWidth < 1024) return;
    // TV mode bypass
    if (window.location.search.includes("tv=true")) return;
    setShow(true);
  }, [location.pathname]);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
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

        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <div className="text-2xl text-muted-foreground">+</div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <Monitor className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-foreground mb-2">
          Best viewed on mobile
        </h2>
        <p className="text-center text-muted-foreground mb-6 text-sm">
          MetsXMFanZone is optimized for the mobile experience. For the best
          experience, please open this site on your phone.
        </p>

        <div className="rounded-lg bg-muted/30 border border-border p-3 mb-6 text-center">
          <p className="text-xs text-muted-foreground">
            Prefer to continue on desktop? Choose an option below.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={() => {
              dismiss();
              navigate("/");
            }}
            variant="outline"
            className="w-full"
          >
            <Home className="w-4 h-4 mr-2" />
            Continue to Home
          </Button>
          <Button
            onClick={() => {
              dismiss();
              navigate("/auth");
            }}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DesktopWelcomeGate;
