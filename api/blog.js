// Serves /blog/:slug for BOTH humans and social crawlers.
// It loads the normal app shell and injects the article's real title,
// description, image and full HTML body, so link previews and in-app
// browsers always see the article — even for posts published after
// the last site build.

import {
  ARTICLE_STYLES,
  buildMetaTags,
  fetchPublishedPost,
  renderArticleBody,
  renderStandalonePage,
} from "./_lib/article.js";

// Remove the template's own social/canonical/title tags so ours are the only set.
function stripExistingMeta(head) {
  return head
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta[^>]+(?:name|property)=["'](?:description|og:|twitter:|article:)[^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "");
}

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
    const [shellResult, post] = await Promise.all([
      loadShell(req).catch(() => null),
      fetchPublishedPost(slug),
    ]);

    if (!post) {
      // Unknown slug: hand the app the shell so it can show its own 404 page.
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.status(404).send(shellResult || "<!doctype html><title>Not found</title>");
      return;
    }

    // No shell available (build hiccup) — still serve a complete article page.
    if (!shellResult) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
      res.status(200).send(renderStandalonePage(post, slug));
      return;
    }

    let html = shellResult;
    const headEnd = html.indexOf("</head>");
    if (headEnd !== -1) {
      const head = stripExistingMeta(html.slice(0, headEnd));
      html = head + buildMetaTags(post, slug) + `<style>${ARTICLE_STYLES}</style>` + html.slice(headEnd);
    }

    // Replace everything inside #root (the prerendered homepage markup) with
    // this article, using the last </div> before the first <script> as the end.
    const rootMatch = html.match(/<div id="root"[^>]*>/);
    if (rootMatch) {
      const start = rootMatch.index + rootMatch[0].length;
      const scriptAt = html.indexOf("<script", start);
      const endAt = html.lastIndexOf("</div>", scriptAt === -1 ? html.length : scriptAt);
      if (endAt > start) {
        html = html.slice(0, start) + `<div class="wrap">${renderArticleBody(post)}</div>` + html.slice(endAt);
      }
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(html);
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
