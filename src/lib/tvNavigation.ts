// Shared helpers for TV mode: where Back goes, leaving the full-screen player, and
// which page each live stream opens.

import { detectTVUserAgent, setTVModePreference } from "@/hooks/use-device";

type Navigate = (to: string, opts?: { replace?: boolean }) => void;

/** True inside the Android TV app. */
export function isTVApp(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("MetsXMFanZoneTV");
}

/**
 * "Leave TV" / "Exit TV" / "Switch to Desktop". On a real TV the app simply closes; a TV never
 * switches to desktop mode. On a PC or tablet that turned TV mode on, it goes back to the normal site.
 */
export function leaveTV(navigate: Navigate): void {
  if (isTVApp()) {
    void import("@capacitor/app").then(({ App }) => App.exitApp()).catch(() => navigate("/tv"));
    return;
  }
  if (detectTVUserAgent()) {
    window.close(); // a TV browser can't always close itself, so it stays on the TV home screen
    navigate("/tv");
    return;
  }
  setTVModePreference(false);
  navigate("/");
  window.location.reload();
}

/** Leave the player's full-screen view (the CSS one used in TV mode, or the browser's). */
export function exitPlayerFullscreen(): boolean {
  const pseudo = document.querySelector<HTMLElement>(".ios-pseudo-fullscreen");
  if (pseudo) {
    pseudo.classList.remove("ios-pseudo-fullscreen");
    return true;
  }
  if (document.fullscreenElement) {
    void document.exitFullscreen?.().catch(() => {});
    return true;
  }
  return false;
}

/**
 * The TV Back button. Leaves full screen (and goes straight to the TV home screen from a live page),
 * otherwise closes a dialog, otherwise returns to the TV home screen from any other page. Returns false when already on the TV home (nothing to do,
 * so the TV app can close itself).
 */
export function handleTVBack(pathname: string, navigate: Navigate): boolean {
  // Expanded live view: one press closes full screen AND returns to the TV home screen.
  if (exitPlayerFullscreen()) {
    if (pathname !== "/tv") navigate("/tv");
    return true;
  }
  if (document.querySelector('[role="dialog"]')) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return true;
  }
  if (pathname !== "/tv") {
    navigate("/tv");
    return true;
  }
  return false;
}

/** Sports network streams (SNY, Apple TV, Prime Video, Peacock, 24/7 channels; old MSG/ESPN/MLB names still match). */
export const NETWORK_STREAM = /\bsny\b|\bmsg\b|espn|mlb network|apple tv|prime video|peacock|pix11|24\/7|network/i;

/** The page that plays a given live stream: networks open their own page, not the Mets TV page. */
export function streamPath(title: string, id: string): string {
  const t = title.trim();
  if (/espn|prime video/i.test(t)) return "/prime-video";
  if (/mlb network|apple tv/i.test(t)) return "/apple-tv";
  if (/\bmsg\b|peacock/i.test(t)) return "/peacock";
  if (/pix11/i.test(t)) return "/pix11-network";
  if (/metsxmfanzone/i.test(t) && !NETWORK_STREAM.test(t.replace(/metsxmfanzone/gi, ""))) return "/metsxmfanzone";
  return `/live/${id}`;
}
