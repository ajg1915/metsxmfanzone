import { useEffect, useState } from "react";

const TV_CODE = "1297199";
const RELEASE_API = "https://api.github.com/repos/ajg1915/metsxmfanzone/releases/tags/tv-app";
const isTVApp = () => typeof navigator !== "undefined" && navigator.userAgent.includes("MetsXMFanZoneTV");
// The Amazon Appstore build updates itself through the store, so it never shows this.
const isStoreBuild = () => navigator.userAgent.includes("AmazonStore");

/**
 * Inside the TV app only: tells people when a newer app file is out.
 * The site itself always updates automatically; this is for the app shell (icon, version).
 */
export function TVUpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isTVApp() || isStoreBuild()) return;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = parseInt(info.build, 10);
        const res = await fetch(RELEASE_API);
        if (!res.ok) return;
        const body: string = (await res.json()).body || "";
        const latest = parseInt(/versionCode=(\d+)/.exec(body)?.[1] ?? "", 10);
        if (!installed || !latest || latest <= installed) return;
        if (localStorage.getItem("tv-update-dismissed") === String(latest)) return;
        if (!cancelled) {
          setShow(true);
          (window as unknown as { __tvLatest?: number }).__tvLatest = latest;
        }
      } catch {
        /* offline or not the native app: say nothing */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem("tv-update-dismissed", String((window as unknown as { __tvLatest?: number }).__tvLatest ?? ""));
    } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div role="alert" className="fixed left-1/2 top-4 z-[9999] w-[min(92vw,900px)] -translate-x-1/2 rounded-2xl border border-[#ff4500] bg-[#0b3a8c] px-6 py-4 text-white shadow-2xl">
      <p className="text-lg font-bold">A new MetsXMFanZone TV update is available</p>
      <p className="mt-1 text-base">
        The app updates your shows and pages by itself. To get the newest app version, open <b>Downloader</b> on your TV, type <b className="text-[#ff9a66]">{TV_CODE}</b> and press Go.
      </p>
      <button type="button" autoFocus onClick={dismiss} className="mt-3 rounded-full bg-[#ff4500] px-6 py-2 text-base font-bold text-white focus:outline-none focus:ring-4 focus:ring-white">
        OK
      </button>
    </div>
  );
}
