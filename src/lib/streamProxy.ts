// Wraps insecure (http://) stream URLs so they can be played from an HTTPS page
// without triggering Mixed Content or CORS errors.

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

/** Our own HTTPS HLS proxy edge function (also rewrites playlist segment URLs). */
export const HLS_PROXY_BASE = PROJECT_ID
  ? `https://${PROJECT_ID}.supabase.co/functions/v1/hls-proxy`
  : "";

/** Public CORS proxy used as a last-resort fallback. */
export const CORS_PROXY_BASE = "https://corsproxy.io/?url=";

export function isInsecureUrl(url: string): boolean {
  return /^http:\/\//i.test(url.trim());
}

/**
 * Returns a playable URL. HTTP sources are routed through the HTTPS HLS proxy
 * (falling back to a public CORS proxy if the edge function isn't configured).
 * HTTPS sources are returned untouched.
 */
export function toSecureStreamUrl(url: string): string {
  const src = (url || "").trim();
  if (!src || !isInsecureUrl(src)) return src;
  if (HLS_PROXY_BASE) return `${HLS_PROXY_BASE}?u=${encodeURIComponent(src)}`;
  return `${CORS_PROXY_BASE}${encodeURIComponent(src)}`;
}

/** Alternate proxy, used if the primary proxied URL fails to load. */
export function toCorsProxyUrl(url: string): string {
  const src = (url || "").trim();
  if (!src) return src;
  return `${CORS_PROXY_BASE}${encodeURIComponent(src)}`;
}
