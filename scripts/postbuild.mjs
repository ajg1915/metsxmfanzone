// Post-build pipeline.
// react-snap needs a working headless Chromium. On some CI hosts (Vercel) that
// download/launch can fail — in that case we still produce every page from the
// prerender templates instead of failing the whole deployment.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  return res.status === 0;
}

// Vercel build containers have no reliable Chromium; use templates there.
const skip = process.env.SKIP_REACT_SNAP === "1" || !!process.env.VERCEL;

if (skip) {
  console.log("react-snap skipped (SKIP_REACT_SNAP=1)");
} else if (!run("npx", ["--no-install", "react-snap"])) {
  console.warn("react-snap failed — continuing with template prerendering only.");
}

if (!run("node", ["prerender.js", "--postprocess"])) {
  console.error("prerender postprocess failed");
  process.exit(1);
}

// Blog articles are rendered on request by api/blog.js so that newly published
// and freshly edited posts are always correct. Remove the build-time article
// copies (dist/blog/<slug>/) so they can't shadow that route with stale content.
// The /blog listing page is served by api/blog-index.js, which adds the latest
// article links to the HTML for search engines. It loads the built page from
// dist/blog-shell.html, so move dist/blog/index.html there (if it stayed, the
// static file would be served first and the function would never run).
const indexHtmlPath = resolve("dist/index.html");
const blogDir = resolve("dist/blog");
if (existsSync(blogDir)) {
  for (const name of readdirSync(blogDir)) {
    const entry = resolve(blogDir, name);
    if (statSync(entry).isDirectory()) rmSync(entry, { recursive: true, force: true });
  }
  console.log("removed dist/blog/<slug> article copies (served dynamically by /api/blog)");
  const blogIndex = resolve(blogDir, "index.html");
  if (existsSync(blogIndex)) {
    // A react-snap snapshot has the rendered app in #root and no insertion
    // marker; put the marker back so api/blog-index.js can add fresh links.
    let shell = readFileSync(blogIndex, "utf8");
    if (!shell.includes("<!--app-html-->")) {
      // Reuse the template's static nav (from dist/index.html) after the marker.
      const tpl = existsSync(indexHtmlPath) ? readFileSync(indexHtmlPath, "utf8") : "";
      const nav = (tpl.match(/<!--app-html-->(<nav[\s\S]*?<\/nav>)/) || [])[1] || "";
      shell = shell.replace(/(<div id="root"[^>]*>)[\s\S]*?(<\/div>\s*<script)/i, (_m, open) => `${open}<!--app-html-->${nav}</div>\n<script`);
    }
    writeFileSync(resolve("dist/blog-shell.html"), shell);
    rmSync(blogIndex, { force: true });
    console.log("moved dist/blog/index.html to dist/blog-shell.html (served with links by /api/blog-index)");
  }
}

// Safety net: any URL that has no prerendered file (e.g. an article published
// after this build) must still load the app instead of a hosting 404 page.
const indexHtml = resolve("dist/index.html");
if (existsSync(indexHtml)) {
  copyFileSync(indexHtml, resolve("dist/404.html"));
  console.log("wrote dist/404.html SPA fallback");
}
