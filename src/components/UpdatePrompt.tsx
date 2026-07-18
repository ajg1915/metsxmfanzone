import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RefreshCw, Sparkles } from "lucide-react";

const UPDATE_CHECK_INTERVAL_MS = 60_000;
const INITIAL_DELAY_MS = 10_000;
const DISMISS_KEY = "mxmfz_update_prompt_dismissed";

const isPreviewHost = () => {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host.includes("id-preview--") ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject.com" ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
};

const extractBuildHash = (html: string) => {
  // Vite emits: <script type="module" crossorigin src="/assets/index-abc123.js"></script>
  const match = html.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/);
  return match ? match[1] : null;
};

const fetchBuildHash = async () => {
  const url = new URL("/index.html", window.location.origin);
  url.searchParams.set("__v", String(Date.now()));

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
  });

  if (!res.ok) return null;
  const html = await res.text();
  return extractBuildHash(html);
};

const refreshPage = () => {
  // Force a hard reload that bypasses service worker caches
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("__refresh", String(Date.now()));
  window.location.replace(nextUrl.toString());
};

export const UpdatePrompt = () => {
  const currentHashRef = useRef<string | null>(null);
  const hasPromptedRef = useRef(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewHost()) return;

    dismissedRef.current = sessionStorage.getItem(DISMISS_KEY) === "1";

    const showUpdateToast = () => {
      if (hasPromptedRef.current || dismissedRef.current) return;
      hasPromptedRef.current = true;

      toast(
        <div className="flex items-start gap-3">
          <div className="bg-primary/20 p-2 rounded-full shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">MetsXMFanZone Updated</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A new version of the site is available. Refresh to get the latest features and fixes.
            </p>
          </div>
        </div>,
        {
          duration: Infinity,
          action: {
            label: (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </span>
            ) as any,
            onClick: refreshPage,
          },
          onDismiss: () => {
            dismissedRef.current = true;
            sessionStorage.setItem(DISMISS_KEY, "1");
          },
        }
      );
    };

    // Capture the hash of the currently running build from the loaded index.html.
    // We can't read the original response, but we can fetch it once now and treat it as baseline.
    const init = async () => {
      try {
        const hash = await fetchBuildHash();
        if (hash) currentHashRef.current = hash;
      } catch {
        // Ignore baseline fetch failures
      }
    };

    const checkForUpdate = async () => {
      if (!currentHashRef.current) {
        currentHashRef.current = await fetchBuildHash();
        return;
      }

      try {
        const newHash = await fetchBuildHash();
        if (newHash && newHash !== currentHashRef.current) {
          showUpdateToast();
        }
      } catch {
        // Ignore network errors; don't spam on flaky connections
      }
    };

    let intervalId: number | undefined;

    const startPolling = () => {
      intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    };

    const timer = window.setTimeout(() => {
      void init().then(startPolling);
    }, INITIAL_DELAY_MS);

    // PWA service-worker update detection
    const handleControllerChange = () => {
      showUpdateToast();
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event?.data?.type === "SW_UPDATED") {
        showUpdateToast();
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
    }

    return () => {
      window.clearTimeout(timer);
      if (intervalId) window.clearInterval(intervalId);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
    };
  }, []);

  return null;
};


export default UpdatePrompt;
