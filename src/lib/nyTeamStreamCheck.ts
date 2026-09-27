export const NY_TEAM_PAGES = [
  "ny-jets",
  "ny-giants",
  "ny-knicks",
  "ny-rangers",
  "ny-islanders",
  "brooklyn-nets",
] as const;

// Shared secondary link used for every NY team event watch page when the
// stream has no URL of its own.
export const NY_TEAM_STREAM_URL = "https://mystream.metsxmfanzone.com/hls/mystream.m3u8";

export const getNYTeamStreamUrl = (stream: {
  stream_url?: string | null;
  assigned_pages?: string[] | null;
}) => {
  if (stream.stream_url) return stream.stream_url;
  const assignedPages = (stream.assigned_pages || []).map((page) => page.toLowerCase());
  if (assignedPages.some((page) => NY_TEAM_PAGES.includes(page as (typeof NY_TEAM_PAGES)[number]))) {
    return NY_TEAM_STREAM_URL;
  }
  return stream.stream_url || "";
};

const NY_TEAM_NAME_PATTERN = /\b(?:new york\s+|ny\s+)?(?:jets|giants|knicks|rangers|islanders)\b|\b(?:brooklyn\s+)?nets\b/i;

export const isNYTeamStream = (stream: {
  title?: string | null;
  description?: string | null;
  assigned_pages?: string[] | null;
}) => {
  const assignedPages = (stream.assigned_pages || []).map((page) => page.toLowerCase());
  if (assignedPages.some((page) => NY_TEAM_PAGES.includes(page as (typeof NY_TEAM_PAGES)[number]))) {
    return true;
  }

  const eventText = `${stream.title || ""} ${stream.description || ""}`;
  // Avoid classifying Mets games against the Texas Rangers or San Francisco
  // Giants as NY football/hockey events. Explicit admin assignments above
  // remain authoritative for any intentional exception.
  if (/\bmets\b/i.test(eventText)) return false;

  return NY_TEAM_NAME_PATTERN.test(eventText);
};
// 24/7 sports network channels included with the NY Sports Streaming package
// (in addition to the six NY team pages above).
export const NY_SPORTS_NETWORK_PAGES = [
  "sny-tv",
  "msg-network",
  "msg-plus",
  "espn-network",
  "mlb-network",
  "metsxmfanzone-2",
] as const;

/** True when a stream/page is covered by the NY Sports Streaming add-on. */
export const isNYSportsPackageStream = (
  stream: {
    title?: string | null;
    description?: string | null;
    assigned_pages?: string[] | null;
  } | null,
  pageKey?: string | null,
) => {
  const keys = [pageKey, ...(stream?.assigned_pages || [])]
    .filter(Boolean)
    .map((page) => String(page).toLowerCase());
  const packagePages: readonly string[] = [...NY_TEAM_PAGES, ...NY_SPORTS_NETWORK_PAGES];
  if (keys.some((key) => packagePages.includes(key))) return true;
  return !!stream && isNYTeamStream(stream);
};
