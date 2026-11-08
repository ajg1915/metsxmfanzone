// Listen-only mode that survives page changes. One hidden audio element plays the live stream, so the
// viewer can keep browsing the site (or lock the phone) and still hear it. The mini player in
// ListenMiniPlayer.tsx and the live player's "Listen" panel both read and control this session.
import Hls from "hls.js";
import { useSyncExternalStore } from "react";
import logoImage from "@/assets/metsxmfanzone-logo.png";
import { toCorsProxyUrl, toSecureStreamUrl, isInsecureUrl } from "@/lib/streamProxy";
import { getSoundPref } from "@/lib/playerSound";

export interface ListenState {
  active: boolean;
  source: string;
  title: string;
  path: string; // page to go back to ("Open stream")
  playing: boolean;
  status: "idle" | "loading" | "ready" | "error";
  panelHosts: number; // how many live players are showing the big Listening panel (hides the mini bar)
}

let state: ListenState = { active: false, source: "", title: "", path: "", playing: false, status: "idle", panelHosts: 0 };
const subs = new Set<() => void>();
const set = (patch: Partial<ListenState>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};

let audio: HTMLAudioElement | null = null;
let hls: Hls | null = null;
let retryTimer: number | undefined;
let loadId = 0;

const isIos = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && (navigator as any).maxTouchPoints > 1);
};

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  const a = document.createElement("audio");
  a.preload = "none";
  a.setAttribute("playsinline", "true");
  a.style.display = "none";
  a.addEventListener("playing", () => set({ playing: true, status: "ready" }));
  a.addEventListener("pause", () => set({ playing: false }));
  a.addEventListener("waiting", () => { if (state.active && state.status === "ready") set({ status: "loading" }); });
  document.body.appendChild(a);
  audio = a;
  return a;
}

function teardown() {
  loadId += 1;
  if (retryTimer) { window.clearTimeout(retryTimer); retryTimer = undefined; }
  if (hls) { try { hls.destroy(); } catch {} hls = null; }
  if (audio) { try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch {} }
}

function setMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  try {
    ms.metadata = new MediaMetadata({
      title: state.title || "Live stream",
      artist: "MetsXMFanZone",
      album: "Live",
      artwork: [{ src: logoImage, sizes: "512x512", type: "image/png" }],
    });
    ms.setActionHandler("play", () => togglePlay(true));
    ms.setActionHandler("pause", () => togglePlay(false));
    ms.setActionHandler("stop", () => stopListening());
  } catch {}
}

function clearMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  try {
    ms.setActionHandler("play", null);
    ms.setActionHandler("pause", null);
    ms.setActionHandler("stop", null);
    ms.metadata = null;
    ms.playbackState = "none";
  } catch {}
}

function load(source: string) {
  const a = getAudio();
  const myId = ++loadId;
  const candidates = Array.from(
    new Set([source, isInsecureUrl(source) ? toSecureStreamUrl(source) : "", toCorsProxyUrl(source)].filter(Boolean)),
  );
  let index = 0;

  const fail = () => {
    if (myId !== loadId) return;
    index += 1;
    if (index < candidates.length) return attempt();
    set({ status: "error", playing: false });
    // Live feeds come and go: keep trying quietly.
    retryTimer = window.setTimeout(() => {
      if (myId !== loadId || !state.active) return;
      index = 0;
      set({ status: "loading" });
      attempt();
    }, 15000);
  };

  const start = () => {
    const pref = getSoundPref();
    a.muted = !pref.on;
    a.volume = pref.volume;
    a.play().catch(() => {});
  };

  const attempt = () => {
    if (myId !== loadId) return;
    if (hls) { try { hls.destroy(); } catch {} hls = null; }
    const url = candidates[index];
    if (!isIos()) a.crossOrigin = "anonymous";

    if (!Hls.isSupported() && a.canPlayType("application/vnd.apple.mpegurl")) {
      a.src = url; // iPhone Safari: native HLS
      a.addEventListener("error", fail, { once: true });
      start();
      return;
    }
    if (!Hls.isSupported()) return fail();

    const h = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30, backBufferLength: 10, liveDurationInfinity: true, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 2, fragLoadingMaxRetry: 6 });
    hls = h;
    h.loadSource(url);
    h.attachMedia(a);
    h.on(Hls.Events.MANIFEST_PARSED, start);
    h.on(Hls.Events.ERROR, (_e, data) => {
      if (myId !== loadId || !data?.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { try { h.recoverMediaError(); return; } catch {} }
      fail();
    });
  };
  attempt();
}

/** The installed Android app can play the stream natively (keeps going with the screen locked). */
function nativePlugin(): any {
  try {
    const w = window as any;
    return w.Capacitor?.isNativePlatform?.() ? w.Capacitor?.Plugins?.ListenService : null;
  } catch { return null; }
}
let nativeHooked = false;
function hookNative(p: any) {
  if (nativeHooked) return;
  nativeHooked = true;
  p.addListener?.("state", (e: { playing: boolean; status: string }) => {
    if (!state.active) return;
    if (e.status === "stopped") { stopListening(); return; }
    set({ playing: !!e.playing, status: e.status === "ready" ? "ready" : e.status === "error" ? "error" : "loading" } as any);
  });
}

/** Start (or switch to) listening to a live stream. Call from a tap so the browser allows sound. */
export function startListening(opts: { source: string; title: string; path?: string }) {
  if (!opts.source) return;
  teardown();
  set({
    active: true,
    source: opts.source,
    title: opts.title,
    path: opts.path || (typeof location !== "undefined" ? location.pathname + location.search : ""),
    playing: false,
    status: "loading",
  });
  setMediaSession();
  const np = nativePlugin();
  if (np) {
    hookNative(np);
    const urls = Array.from(new Set([opts.source, isInsecureUrl(opts.source) ? toSecureStreamUrl(opts.source) : ""].filter(Boolean)));
    np.start({ title: opts.title, urls }).catch(() => { teardown(); load(opts.source); });
    return;
  }
  load(opts.source);
}

export function stopListening() {
  teardown();
  clearMediaSession();
  try { nativePlugin()?.stop?.(); } catch {}
  set({ active: false, source: "", title: "", playing: false, status: "idle" });
}

export function togglePlay(want?: boolean) {
  const np = nativePlugin();
  if (np && state.active) { np.setPlaying({ playing: typeof want === "boolean" ? want : !state.playing }); return; }
  const a = audio;
  if (!a || !state.active) return;
  const play = typeof want === "boolean" ? want : a.paused;
  if (play) { a.muted = false; a.play().catch(() => {}); }
  else a.pause();
  try { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = play ? "playing" : "paused"; } catch {}
}

/** A live player on screen is showing the big Listening panel, so the mini bar stays hidden. */
export function registerPanelHost() {
  set({ panelHosts: state.panelHosts + 1 });
  return () => set({ panelHosts: Math.max(0, state.panelHosts - 1) });
}

export function useListenSession(): ListenState {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => state,
    () => state,
  );
}
