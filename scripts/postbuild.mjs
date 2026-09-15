// Post-build pipeline.
// react-snap needs a working headless Chromium. On some CI hosts (Vercel) that
// download/launch can fail — in that case we still produce every page from the
// prerender templates instead of failing the whole deployment.
import { spawnSync } from "node:child_process";

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
