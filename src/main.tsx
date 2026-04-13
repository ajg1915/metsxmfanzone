import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications and offline caching
// NOTE: the Lovable preview environment can be unstable with a Service Worker enabled
// (cached JS/CSS can get out of sync during rapid iterations). We disable + fully clean SW
// on preview hosts to prevent the "Sorry, we ran into an issue starting the live preview" modal.
// Always purge all browser caches on every page load to guarantee fresh content
const purgeAllCaches = async () => {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      if (keys.length > 0) {
        console.log("[App] Purged", keys.length, "cache(s)");
      }
    }
  } catch (e) {
    console.warn("[App] Cache purge failed", e);
  }
};

void purgeAllCaches();

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
      const registration = await navigator.serviceWorker.register("/sw.js", {
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
