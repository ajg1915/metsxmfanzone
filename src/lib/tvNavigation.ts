// Shared helpers for TV mode: where Back goes, leaving the full-screen player, and
// which page each live stream opens.

type Navigate = (to: string, opts?: { replace?: boolean }) => void;

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
 * The TV Back button. Leaves full screen first, then closes a dialog, then returns to the
 * TV home screen from any other page. Returns false when already on the TV home (nothing to do,
 * so the TV app can close itself).
 */
export function handleTVBack(pathname: string, navigate: Navigate): boolean {
  if (exitPlayerFullscreen()) return true;
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

/** Sports network streams (SNY, MSG, ESPN, MLB Network, 24/7 channels). */
export const NETWORK_STREAM = /\bsny\b|\bmsg\b|espn|mlb network|pix11|24\/7|network/i;

/** The page that plays a given live stream: networks open their own page, not the Mets TV page. */
export function streamPath(title: string, id: string): string {
  const t = title.trim();
  if (/espn/i.test(t)) return "/espn-network";
  if (/mlb network/i.test(t)) return "/mlb-network";
  if (/\bmsg\b/i.test(t)) return "/msg-network";
  if (/pix11/i.test(t)) return "/pix11-network";
  if (/metsxmfanzone/i.test(t) && !NETWORK_STREAM.test(t.replace(/metsxmfanzone/gi, ""))) return "/metsxmfanzone";
  return `/live/${id}`;
}
