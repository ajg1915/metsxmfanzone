// Post-build pipeline.
// react-snap needs a working headless Chromium. On some CI hosts (Vercel) that
// download/launch can fail — in that case we still produce every page from the
// prerender templates instead of failing the whole deployment.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
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
// and freshly edited posts are always correct. Remove the build-time copies so
// they can't shadow that route with stale content.
if (existsSync(resolve("dist/blog"))) {
  rmSync(resolve("dist/blog"), { recursive: true, force: true });
  console.log("removed dist/blog (served dynamically by /api/blog)");
}

// Safety net: any URL that has no prerendered file (e.g. an article published
// after this build) must still load the app instead of a hosting 404 page.
const indexHtml = resolve("dist/index.html");
if (existsSync(indexHtml)) {
  copyFileSync(indexHtml, resolve("dist/404.html"));
  console.log("wrote dist/404.html SPA fallback");
}
