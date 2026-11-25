// Articles live on Cloudflare (articles-api Worker, D1 "metsxm-articles") since Nov 2026.
// Edge functions read published articles from there instead of the old blog_posts table.
const ARTICLES_API = (Deno.env.get("ARTICLES_API") || "https://articles-api.metsxmfan.workers.dev").replace(/\/+$/, "");

export interface PublishedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content?: string | null;
  featured_image_url: string | null;
  category: string | null;
  tags: string[];
  published_at: string | null;
  updated_at: string | null;
  created_at: string;
  meta_description: string | null;
}

async function get(path: string): Promise<any> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${ARTICLES_API}${path}`, { signal: AbortSignal.timeout(5000) });
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
      last = new Error(`articles-api ${r.status}`);
    } catch (e) {
      last = e;
    }
    await new Promise((res) => setTimeout(res, 300 * (i + 1)));
  }
  throw last;
}

/** Published articles, newest first. */
export async function listPublishedArticles(
  params: { limit?: number; fields?: "card" | "seo" | "full"; since?: string } = {},
): Promise<PublishedArticle[]> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  const body = await get(`/posts?${q.toString()}`);
  return body?.posts || [];
}

/** One published article by slug, or null. */
export async function getPublishedArticle(slug: string): Promise<PublishedArticle | null> {
  const body = await get(`/posts/${encodeURIComponent(slug)}`);
  return body?.post || null;
}
