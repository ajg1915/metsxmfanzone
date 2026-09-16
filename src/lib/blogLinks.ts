/**
 * Centralized helpers for building blog article URLs.
 *
 * Public shares should always use the clean canonical article route
 * `/blog/:slug`. On production, the Cloudflare Worker intercepts crawler
 * requests on that route and forwards them to `blog-og-meta`, where the slug
 * is used as the database lookup key for `blog_posts`.
 *
 * Result:
 * - humans open the real article URL directly
 * - crawlers still get OG/Twitter/JSON-LD HTML first
 */

const SITE_URL = "https://metsxmfanzone.com";

export function getBlogShareUrl(slug: string): string {
  return `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
}

export function getBlogInternalPath(slug: string): string {
  return `/blog/${slug}`;
}

/**
 * Normalizes legacy function/share helper URLs back to the canonical public
 * article route so human-facing shares never point at the function endpoint.
 */
export function normalizeToBlogShareUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, SITE_URL);

    if (
      parsed.hostname === "metsxmfanzone.com" ||
      parsed.hostname === "www.metsxmfanzone.com"
    ) {
      parsed.protocol = "https:";
      parsed.hostname = "metsxmfanzone.com";
      parsed.port = "";
    }

    if (parsed.pathname.includes("/functions/v1/blog-og-meta")) {
      const pathSegments = parsed.pathname.split("/").filter(Boolean);
      const ogIdx = pathSegments.indexOf("blog-og-meta");
      const functionSlug =
        parsed.searchParams.get("slug") ||
        (ogIdx !== -1 ? pathSegments[ogIdx + 1] : undefined);

      return functionSlug ? getBlogShareUrl(decodeURIComponent(functionSlug)) : parsed.toString();
    }

    const blogMatch = parsed.pathname.match(/^\/blog\/([^/?#]+)/);
    if (blogMatch?.[1]) {
      return getBlogShareUrl(decodeURIComponent(blogMatch[1]));
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    const ogIdx = parts.indexOf("og-blog");
    if (ogIdx !== -1 && parts[ogIdx + 1]) {
      return getBlogShareUrl(decodeURIComponent(parts[ogIdx + 1]));
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}
