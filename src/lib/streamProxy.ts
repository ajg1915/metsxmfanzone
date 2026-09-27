// Routes external HLS playlists through our own HTTPS proxy so browsers can load
// playlists, segments, keys, and maps even when the upstream host omits CORS headers.

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export const HLS_PROXY_BASE = PROJECT_ID
  ? `https://${PROJECT_ID}.supabase.co/functions/v1/hls-proxy`
  : "";

export function toPlayableStreamUrl(url: string): string {
  const src = (url || "").trim();
  if (!src || !HLS_PROXY_BASE) return src;

  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return src;
    return `${HLS_PROXY_BASE}?u=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return src;
  }
}

// Kept for existing callers.
export const isInsecureUrl = (url: string): boolean => /^http:\/\//i.test(url.trim());
export const toSecureStreamUrl = toPlayableStreamUrl;
export const toCorsProxyUrl = toPlayableStreamUrl;
