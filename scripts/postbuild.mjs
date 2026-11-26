// Post-build pipeline: writes a real HTML file for every public page from the
// prerender templates (see prerender.js).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  return res.status === 0;
}

// Every page is built from the prerender templates (no headless browser needed).
if (!run("node", ["prerender.js", "--postprocess"])) {
  console.error("prerender postprocess failed");
  process.exit(1);
}

// Blog articles are rendered on request by api/blog.js so that newly published
// and freshly edited posts are always correct. Remove the build-time article
// copies (dist/blog/<slug>/) so they can't shadow that route with stale content.
// Keep dist/blog/index.html: it is the public /blog listing page, and without it
// /blog has nothing to serve and returns a hosting 404.
const blogDir = resolve("dist/blog");
if (existsSync(blogDir)) {
  for (const name of readdirSync(blogDir)) {
    const entry = resolve(blogDir, name);
    if (statSync(entry).isDirectory()) rmSync(entry, { recursive: true, force: true });
  }
  console.log("removed dist/blog/<slug> article copies (served dynamically by /api/blog); kept dist/blog/index.html");
}

// Safety net: any URL that has no prerendered file (e.g. an article published
// after this build) must still load the app instead of a hosting 404 page.
// It is the empty, noindex app shell (not the home page), so unknown addresses answer
// a real 404 and the app shows its "Page not found" screen.
const shellHtml = resolve("dist/app-shell/index.html");
const indexHtml = resolve("dist/index.html");
const notFoundSource = existsSync(shellHtml) ? shellHtml : indexHtml;
if (existsSync(notFoundSource)) {
  copyFileSync(notFoundSource, resolve("dist/404.html"));
  console.log(`wrote dist/404.html from ${notFoundSource.includes("app-shell") ? "app shell" : "index.html"}`);
}
