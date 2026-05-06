import { useEffect, useState } from "react";
import splashImage from "@/assets/splash-screen.png";

/**
 * Mobile-only splash screen shown on app cold-start.
 * Fades out after ~1.8s. Only displays on viewports < 768px.
 */
const MobileSplashScreen = () => {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    // Only show on mobile viewports
    if (window.innerWidth >= 768) return false;
    // Only once per session
    if (sessionStorage.getItem("mxmfz_splash_shown") === "1") return false;
    return true;
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem("mxmfz_splash_shown", "1");
    const fadeTimer = setTimeout(() => setFading(true), 1400);
    const hideTimer = setTimeout(() => setVisible(false), 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Loading MetsXMFanZone"
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <img
        src={splashImage}
        alt="MetsXMFanZone"
        width={1024}
        height={1024}
        className="w-full h-full object-cover animate-scale-in"
      />
      <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs uppercase tracking-[0.3em] text-foreground/70">
          Loading
        </p>
      </div>
    </div>
  );
};

export default MobileSplashScreen;
