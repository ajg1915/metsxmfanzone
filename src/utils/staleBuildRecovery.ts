/**
 * Recovery helper for "Invalid API key" style auth failures.
 *
 * These errors are almost always caused by a stale cached app bundle (old PWA
 * install / service worker) that still carries an outdated backend key. The
 * running app cannot fix the old bundle — it has to be thrown away and the app
 * reloaded from the network.
 */

const RECOVERY_FLAG = "stale_build_recovery_at";
const RECOVERY_COOLDOWN_MS = 60_000;

export const isStaleBuildAuthError = (message?: string | null) => {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("invalid api key") ||
    m.includes("no api key found") ||
    m.includes("invalid authentication credentials")
  );
};

/**
 * Clears every cache + service worker registration and reloads the app so the
 * browser fetches the current bundle. Returns false when a recovery reload was
 * already attempted moments ago (prevents reload loops).
 */
export const recoverFromStaleBuild = async (): Promise<boolean> => {
  try {
    const last = Number(sessionStorage.getItem(RECOVERY_FLAG) || 0);
    if (last && Date.now() - last < RECOVERY_COOLDOWN_MS) return false;
    sessionStorage.setItem(RECOVERY_FLAG, String(Date.now()));
  } catch {
    // Session storage unavailable (private mode) — still attempt one recovery.
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Ignore cache clearing failures.
  }

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    // Ignore service worker cleanup failures.
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("fresh", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }

  return true;
};
