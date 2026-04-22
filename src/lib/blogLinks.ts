/**
 * Centralized helpers for building blog article URLs.
 *
 * The Edge Function `blog-og-meta` is the single entry point that:
 *   1. Receives the slug from the URL.
 *   2. Uses the slug as the key to query `blog_posts` in the database.
 *   3. Returns crawler-ready HTML with Open Graph / Twitter / JSON-LD tags.
 *   4. Redirects human visitors to the real SPA route `/blog/:slug`.
 *
 * Use `getBlogShareUrl(slug)` for ANY link that leaves the app
 * (social shares, push notifications, emails, hero CTA links, etc.)
 * so that the Edge Function always processes the request first.
 *
 * Use `getBlogInternalPath(slug)` only for in-app `<Link>` navigation
 * where SPA routing is desired (no full page reload).
 */

const SITE_URL =
  (typeof window !== "undefined" && window.location.origin) ||
  "https://www.metsxmfanzone.com";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as
  | string
  | undefined;

/**
 * Builds the Edge Function URL that processes the slug against the database
 * and returns OG-tagged HTML (then redirects humans to the article).
 */
export function getBlogShareUrl(slug: string): string {
  const safeSlug = encodeURIComponent(slug);

  if (PROJECT_ID) {
    return `https://${PROJECT_ID}.supabase.co/functions/v1/blog-og-meta/${safeSlug}`;
  }

  // Fallback: direct article URL if project id is unavailable at build time.
  return `${SITE_URL}/blog/${safeSlug}`;
}

/**
 * In-app SPA path for React Router navigation. Does NOT route through the
 * Edge Function — use this only for internal links.
 */
export function getBlogInternalPath(slug: string): string {
  return `/blog/${slug}`;
}

/**
 * Given any URL that points at a blog article (either the SPA route or the
 * legacy /og-blog/:slug helper), returns the Edge Function URL. Other URLs
 * are returned unchanged.
 */
export function normalizeToBlogShareUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, SITE_URL);

    if (parsed.pathname.includes("/functions/v1/blog-og-meta")) {
      const pathSegments = parsed.pathname.split("/").filter(Boolean);
      const ogIdx = pathSegments.indexOf("blog-og-meta");
      const functionSlug =
        parsed.searchParams.get("slug") ||
        (ogIdx !== -1 ? pathSegments[ogIdx + 1] : undefined);

      return functionSlug ? getBlogShareUrl(decodeURIComponent(functionSlug)) : rawUrl;
    }

    const blogMatch = parsed.pathname.match(/^\/blog\/([^/?#]+)/);
    if (blogMatch?.[1]) {
      return getBlogShareUrl(blogMatch[1]);
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    const ogIdx = parts.indexOf("og-blog");
    if (ogIdx !== -1 && parts[ogIdx + 1]) {
      return getBlogShareUrl(parts[ogIdx + 1]);
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}
