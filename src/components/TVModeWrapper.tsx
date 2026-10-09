import { useDevice, setTVModePreference } from "@/hooks/use-device";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useTVFocusNav } from "@/hooks/useTVFocusNav";
import { handleTVBack } from "@/lib/tvNavigation";
import { Button } from "@/components/ui/button";
import { Tv, X, Monitor, Home } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface TVModeWrapperProps {
  children: React.ReactNode;
}

export function TVModeWrapper({ children }: TVModeWrapperProps) {
  const { isTV, isTVDevice } = useDevice();
  const { user, loading: authLoading } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();
  const [showTVBar, setShowTVBar] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // TV mode is for paid members only. A TV device always gets the big-screen
  // layout and remote navigation (so the sign-in screen works), but the TV
  // home screen itself only opens for signed-in paid members.
  const isTVEligible = isTV && !!user && isPremium;
  const isLoading = authLoading || subLoading;

  // Remote-control navigation across the whole site (not just /tv)
  const tvActive = isTVDevice || (isTVEligible && !isLoading);
  const onBack = useCallback(() => handleTVBack(location.pathname, navigate), [location.pathname, navigate]);
  useTVFocusNav(tvActive, onBack);

  // Android TV app: the remote's Back button goes to the TV home, and closes the app from there.
  useEffect(() => {
    if (!navigator.userAgent.includes("MetsXMFanZoneTV")) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    import("@capacitor/app")
      .then(({ App }) =>
        App.addListener("backButton", () => {
          if (!handleTVBack(location.pathname, navigate)) void App.exitApp();
        }),
      )
      .then((h) => {
        if (cancelled) void h.remove();
        else remove = () => void h.remove();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [location.pathname, navigate]);

  // A TV that opens the site lands on the TV home screen, not the phone/desktop home page.
  useEffect(() => {
    // Only for a real TV device — never for a normal desktop monitor.
    if (isTVDevice && location.pathname === "/") {
      navigate("/tv", { replace: true });
    }
  }, [isTVDevice, location.pathname, navigate]);

  // Show the top bar only for eligible users
  useEffect(() => {
    if (isTVEligible && !dismissed) {
      setShowTVBar(true);
    } else {
      setShowTVBar(false);
    }
  }, [isTVEligible, dismissed]);

  // Apply TV scaling class only for eligible users
  useEffect(() => {
    const html = document.documentElement;
    if (isTVDevice || isTVEligible) {
      html.classList.add("tv-mode");
    } else {
      html.classList.remove("tv-mode");
    }
    return () => html.classList.remove("tv-mode");
  }, [isTVDevice, isTVEligible]);

  return (
    <>
      {/* TV Mode bar: only for paid TV users, hidden on the TV dashboard where it isn't needed */}
      {showTVBar && location.pathname !== "/tv" && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-card/95 backdrop-blur border-b border-primary/30 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-primary" />
            <span className="text-xs text-foreground font-medium">TV Mode Active</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => navigate("/tv")}>
              <Home className="w-3.5 h-3.5" />
              TV Home
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                setTVModePreference(false);
                window.location.reload();
              }}
            >
              <Monitor className="w-3.5 h-3.5" />
              Switch to Desktop
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDismissed(true)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
