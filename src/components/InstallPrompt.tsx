import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone, Monitor, Tv, ChevronRight, Share, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { claimPromptSlot, isSnoozed, msUntilFirstPrompt, snoozePrompt } from "@/lib/promptCoordinator";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isIOSSafari = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS|Chrome/.test(ua);
  return isIOS && isSafari;
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    // Stay quiet for a week after it was closed
    if (isSnoozed("install")) return;

    // Show after the first 30 seconds of the visit, and only if no other prompt has the slot
    const scheduleShow = () =>
      window.setTimeout(() => {
        if (claimPromptSlot("install")) setShowPrompt(true);
      }, msUntilFirstPrompt() + 50);

    // iOS Safari path
    if (isIOSSafari()) {
      setIsIOS(true);
      scheduleShow();
      return;
    }

    // Android / Chrome path
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      scheduleShow();
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    snoozePrompt("install");
  };

  const handleLearnMore = () => {
    handleDismiss();
    navigate("/install");
  };

  if (isInstalled || (!showPrompt && !deferredPrompt && !isIOS)) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-[380px]"
        >
          <Card className="p-5 shadow-2xl border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 backdrop-blur-xl overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />

            <div className="relative">
              <Button
                onClick={handleDismiss}
                size="icon"
                variant="ghost"
                className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 pr-6">
                  <h3 className="font-bold text-base mb-1">Install MetsXMFanZone</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isIOS
                      ? "Add this app to your Home Screen for the best experience"
                      : "Get the full app experience with offline access and push notifications"}
                  </p>
                </div>
              </div>

              {/* iOS Safari instructions */}
              {isIOS ? (
                <div className="mb-4 space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary font-bold text-xs shrink-0">1</div>
                    <span className="text-foreground/80">
                      Tap the <Share className="inline h-4 w-4 text-primary mx-0.5 -mt-0.5" /> <strong>Share</strong> button in Safari
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary font-bold text-xs shrink-0">2</div>
                    <span className="text-foreground/80">
                      Scroll down and tap <strong>"Add to Home Screen"</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary font-bold text-xs shrink-0">3</div>
                    <span className="text-foreground/80">
                      Tap <strong>"Add"</strong> to install
                    </span>
                  </div>
                  {/* Arrow pointing down to Safari share button */}
                  <div className="flex justify-center pt-1">
                    <ArrowUp className="h-5 w-5 text-primary animate-bounce rotate-180" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-primary" />
                    <span>Mobile</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5 text-primary" />
                    <span>Desktop</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tv className="h-3.5 w-3.5 text-primary" />
                    <span>Smart TV</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {isIOS ? (
                  <Button
                    onClick={handleDismiss}
                    className="flex-1 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    Got It
                  </Button>
                ) : deferredPrompt ? (
                  <Button
                    onClick={handleInstall}
                    className="flex-1 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    <Download className="h-4 w-4" />
                    Install Now
                  </Button>
                ) : (
                  <Button
                    onClick={handleLearnMore}
                    className="flex-1 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    How to Install
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  onClick={handleLearnMore}
                  variant="outline"
                  className="gap-1 text-xs"
                >
                  All Devices
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
