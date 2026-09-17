import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { isRecoverableDynamicImportError, reloadForFreshAssets } from "./lib/lazyWithRetry";
import "./index.css";

// Keep one stable public hostname. Older social posts and saved links may still
// use www; normalize them before the app, service worker, or auth client starts.
if (window.location.hostname === "www.metsxmfanzone.com") {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = "metsxmfanzone.com";
  window.location.replace(canonicalUrl.toString());
}

// Register one push-only service worker. It must not intercept page navigation:
// Android in-app browsers can surface a rejected service-worker fetch as ERR_FAILED.
// NOTE: the Lovable preview environment can be unstable with a Service Worker enabled
// (cached JS/CSS can get out of sync during rapid iterations). We disable + fully clean SW
// on preview hosts to prevent the "Sorry, we ran into an issue starting the live preview" modal.

// Auto-recover from stale dynamic import chunks after a redeploy.
// When the deployed index.html references new hashed JS files but the user
// still has the old SPA loaded, lazy() imports throw "Failed to fetch
// dynamically imported module". We hard-navigate once with a cache-busting
// query param so the browser fetches the fresh asset graph.
const STALE_RELOAD_KEY = "__stale_chunk_reloaded_at";
const handleStaleChunk = (error: unknown) => {
  if (!isRecoverableDynamicImportError(error)) return;
  reloadForFreshAssets(STALE_RELOAD_KEY);
};
window.addEventListener("error", (e) => handleStaleChunk(e?.error ?? e?.message));
window.addEventListener("unhandledrejection", (e) => handleStaleChunk(e?.reason));

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.endsWith(".lovableproject.com") ||
  window.location.hostname === "lovableproject.com";

if (isPreviewHost) {
  // Unregister all SWs in preview
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => r.unregister())
    );
  }
} else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      });
      console.log("[App] Service Worker registered:", registration.scope);

      // No periodic update checks - let natural navigation handle updates
      // This prevents constant refreshing while still maintaining push notification support
    } catch (error) {
      console.error("[App] Service Worker registration failed:", error);
    }
  });
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found. Make sure there is a div with id='root' in your HTML.");
}

// Clear any placeholder content and render the app
rootElement.innerHTML = '';

createRoot(rootElement).render(
  <HelmetProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </HelmetProvider>
);
