// Serves /blog-html/:slug — a complete, standalone HTML page for one article.
// No React, no app shell: the headline, photo and full story are in the HTML
// itself, so it opens anywhere (social media in-app browsers, email, crawlers).

import { fetchPublishedPost, renderStandalonePage, SITE_URL } from "./_lib/article.js";

export default async function handler(req, res) {
  const slugParam = req.query?.slug;
  const slug = decodeURIComponent(
    (Array.isArray(slugParam) ? slugParam.join("/") : slugParam || "").trim(),
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!slug) {
    res.status(400).send("<!doctype html><title>Missing article</title><p>No article requested.</p>");
    return;
  }

  try {
    const post = await fetchPublishedPost(slug);
    if (!post) {
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res
        .status(404)
        .send(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Article not found | MetsXMFanZone</title></head><body style="background:#07101f;color:#eaf1ff;font-family:system-ui;padding:2rem"><h1>Article not found</h1><p>This story may have been unpublished. <a style="color:#f5761a" href="${SITE_URL}/blog">Browse the latest Mets news</a>.</p></body></html>`,
        );
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(renderStandalonePage(post, slug));
  } catch {
    res.status(500).send("<!doctype html><title>Error</title><p>Could not load this article.</p>");
  }
}
