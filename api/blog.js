// Serves /blog/:slug for BOTH humans and social crawlers.
// Every visitor gets one complete, script-free, branded article page rendered from
// the live database, so it opens in every browser (incl. social in-app browsers)
// and link previews are always correct — even for posts newer than the last build.

import { fetchPublishedPost, fetchRelatedPosts, renderStandalonePage } from "./_lib/article.js";

async function loadShell(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "metsxmfanzone.com";
  const proto = req.headers["x-forwarded-proto"] || "https";
  // Root path only — never /blog/*, so this can never call back into itself.
  const res = await fetch(`${proto}://${host}/`, {
    headers: { "user-agent": "internal-prerender" },
  });
  if (!res.ok) throw new Error(`Shell load failed: ${res.status}`);
  return await res.text();
}

export default async function handler(req, res) {

  const slugParam = req.query?.slug;
  const slug = decodeURIComponent(
    (Array.isArray(slugParam) ? slugParam.join("/") : slugParam || "").trim(),
  );

  if (!slug) {
    res.status(400).send("Invalid slug");
    return;
  }

  try {
    const post = await fetchPublishedPost(slug);

    if (!post) {
      // Unknown slug: hand the app the shell so it can show its own 404 page.
      const shell = await loadShell(req).catch(() => null);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.status(404).send(shell || "<!doctype html><title>Not found</title>");
      return;
    }

    // Every visitor gets the same complete, script-free article page. It needs no
    // service worker, push SDK or app bundle, so it opens in every browser,
    // including the Facebook / Instagram / TikTok / X in-app browsers.
    const related = await fetchRelatedPosts(slug);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(renderStandalonePage(post, slug, related));
  } catch {
    // Never fail the page: fall back to the plain app shell.
    try {
      const shell = await loadShell(req);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(shell);
    } catch {
      res.status(500).send("Internal Server Error");
    }
  }
}
