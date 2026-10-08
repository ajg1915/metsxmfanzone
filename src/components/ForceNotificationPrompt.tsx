import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/metsxmfanzone-logo.png";
import { claimPromptSlot, isEngaged, isSnoozed, snoozePrompt } from "@/lib/promptCoordinator";

const ForceNotificationPrompt = () => {
  const [show, setShow] = useState(false);
  const { permission, requestPermission } = useNotifications();

  useEffect(() => {
    // Don't show if notifications aren't supported
    if (!("Notification" in window)) return;
    // Don't show if already granted
    if (permission === "granted") return;
    // Don't show if permanently denied (browser level)
    if (permission === "denied") return;

    // Stay quiet for a week after it was closed
    if (isSnoozed("notifications")) return;

    // Ask only after the visitor has read or watched something (or stayed a couple of
    // minutes), after the first 30 seconds, and only if no other prompt has the slot.
    const timer = window.setInterval(() => {
      if (isEngaged() && claimPromptSlot("notifications")) {
        setShow(true);
        window.clearInterval(timer);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [permission]);

  const handleEnable = useCallback(async () => {
    await requestPermission();
    setShow(false);
  }, [requestPermission]);

  const handleDismiss = useCallback(() => {
    snoozePrompt("notifications");
    setShow(false);
  }, []);

  // Check if running as installed PWA
  const isPWA = window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[380px] z-[9999] rounded-2xl overflow-hidden shadow-2xl border border-primary/30"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          }}
        >
          <div className="p-4 sm:p-5">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center">
                <img src={logo} alt="" className="w-8 h-8 rounded-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-sm sm:text-base leading-tight">
                  {isPWA ? "🔔 Enable Live Game Alerts" : "🏟️ Never Miss a Mets Moment!"}
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-relaxed">
                  {isPWA
                    ? "Get instant alerts when games go live, scores update, and breaking news drops — right on your phone!"
                    : "Enable notifications to get live game alerts, score updates, and breaking Mets news pushed directly to your screen."}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors p-1"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleEnable}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all active:scale-95"
              >
                <Bell className="w-4 h-4" />
                Enable Notifications
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-3 text-gray-400 hover:text-gray-200 text-sm font-medium rounded-xl hover:bg-white/5 transition-all"
              >
                Later
              </button>
            </div>

            {/* Trust indicator */}
            <p className="text-center text-gray-500 text-[10px] mt-3">
              You can turn off notifications anytime in your settings
            </p>
          </div>

          {/* Animated accent bar */}
          <div className="h-1 bg-gradient-to-r from-primary via-orange-400 to-primary animate-pulse" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForceNotificationPrompt;
