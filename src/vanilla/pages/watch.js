import Hls from "hls.js";
import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml, safeUrl } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";

const PAGE_STREAM_KEYS = {
  "/metsxmfanzone": "metsxmfanzone",
  "/mlb-network": "mlb-network",
  "/espn-network": "espn-network",
  "/pix11-network": "pix11-network",
  "/msg-network": "msg-network",
  "/msg-plus": "msg-plus",
  "/gameday-live": "gameday-live",
  "/replay-games": "replay-games",
};

export const watchPaths = Object.keys(PAGE_STREAM_KEYS);

const startTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      }).format(new Date(value)) + " ET"
    : "Scheduled";

export const attachPlayer = (video, url) => {
  if (!video || !url) return () => {};

  if (video.canPlayType("application/vnd.apple.mpegurl") && !Hls.isSupported()) {
    video.src = url;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }

  if (!Hls.isSupported()) {
    video.src = url;
    return () => {};
  }

  const hls = new Hls({ lowLatencyMode: true, enableWorker: true, backBufferLength: 30 });
  let mediaRecoveries = 0;
  let networkRetries = 0;

  hls.loadSource(url);
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video.play().catch(() => {});
  });
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data?.fatal) return;
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 3) {
      mediaRecoveries += 1;
      if (mediaRecoveries > 1) hls.swapAudioCodec();
      hls.recoverMediaError();
      return;
    }
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 5) {
      networkRetries += 1;
      setTimeout(() => hls.startLoad(), 1500 * networkRetries);
      return;
    }
    hls.destroy();
  });

  return () => {
    try {
      hls.destroy();
    } catch {
      /* already destroyed */
    }
  };
};

const playerMarkup = (stream) => `
  <section class="content-width player-panel">
    <video id="stream-player" class="stream-player" controls playsinline autoplay
      poster="${safeUrl(stream.thumbnail_url || "/share/metsxmfanzone.jpg", "/share/metsxmfanzone.jpg")}"></video>
    <h1>${escapeHtml(stream.title || "MetsXMFanZone Live")}</h1>
    <p class="stream-meta">${stream.status === "live" ? "Live now" : startTime(stream.scheduled_start)}</p>
    ${stream.description ? `<p>${escapeHtml(stream.description)}</p>` : ""}
  </section>`;

const gate = (pathname) =>
  statusPanel(
    "Members only",
    "A MetsXMFanZone membership is required to watch live streams.",
    { href: `/plans?required=true&next=${encodeURIComponent(pathname)}`, label: "See membership plans" },
  );

const renderStream = async (root, pathname, stream) => {
  setPageMetadata({
    title: `${stream.title || "Watch Live"} | MetsXMFanZone`,
    description: stream.description || "Watch live New York Mets coverage on MetsXMFanZone.",
    path: pathname,
    image: stream.thumbnail_url || "/share/metsxmfanzone.jpg",
    type: "video.other",
  });

  root.innerHTML = renderShell({ content: playerMarkup(stream), currentPath: pathname });
  bindShell(root);

  const video = root.querySelector("#stream-player");
  const detach = attachPlayer(video, stream.stream_url);
  window.addEventListener("popstate", detach, { once: true });
};

const loadPageStream = async (pageKey) => {
  const { data } = await backend
    .from("live_streams")
    .select("id,title,description,stream_url,thumbnail_url,status,scheduled_start,assigned_pages,display_order")
    .eq("published", true)
    .contains("assigned_pages", [pageKey])
    .order("display_order", { ascending: true })
    .limit(10);

  const streams = data || [];
  return streams.find((item) => item.status === "live") || streams[0] || null;
};

export const renderWatchPage = async (root, pathname) => {
  root.innerHTML = renderShell({ content: statusPanel("Live", "Loading the stream…"), currentPath: pathname });
  bindShell(root);

  const state = await auth.ready();
  if (!state.isMember) {
    root.innerHTML = renderShell({ content: gate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }

  const stream = await loadPageStream(PAGE_STREAM_KEYS[pathname]);
  if (!stream) {
    root.innerHTML = renderShell({
      content: statusPanel("Live", "Nothing is streaming on this channel right now.", { href: "/", label: "Back home" }),
      currentPath: pathname,
    });
    bindShell(root);
    return;
  }

  await renderStream(root, pathname, stream);
};

export const renderLiveStream = async (root, id) => {
  const pathname = `/live/${id}`;
  root.innerHTML = renderShell({ content: statusPanel("Live", "Loading the stream…"), currentPath: pathname });
  bindShell(root);

  const state = await auth.ready();
  if (!state.isMember) {
    root.innerHTML = renderShell({ content: gate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }

  const { data: stream } = await backend
    .from("live_streams")
    .select("id,title,description,stream_url,thumbnail_url,status,scheduled_start")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();

  if (!stream) {
    root.innerHTML = renderShell({
      content: statusPanel("Live", "This stream is no longer available.", { href: "/", label: "Back home" }),
      currentPath: pathname,
    });
    bindShell(root);
    return;
  }

  await renderStream(root, pathname, stream);
};
