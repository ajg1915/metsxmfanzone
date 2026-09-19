/**
 * Generates /static-site/ — standalone HTML/CSS/vanilla-JS copies of every
 * public page in the app. Does not touch any React source file.
 *
 * Run: node scripts/build-static-site.mjs
 */
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "static-site");
const SITE_URL = "https://metsxmfanzone.com";

const registry = JSON.parse(
  await readFile(path.join(ROOT, "src/data/share-pages.json"), "utf8")
);
const shareImages = new Set(await readdir(path.join(ROOT, "public/share")));

const fileFor = (p) =>
  p === "/" ? "index.html" : `${p.replace(/^\//, "").replace(/\//g, "-")}.html`;

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const imageFor = (entry) => {
  const name = (entry.image || "").replace("/share/", "");
  return shareImages.has(name) ? `https://metsxmfanzone.com/share/${name}` : `${SITE_URL}/og-image.png`;
};

const byPath = new Map(registry.map((e) => [e.path, e]));
const link = (p, label) => {
  const entry = byPath.get(p);
  return `<a href="${fileFor(p)}">${esc(label || (entry && entry.label) || p)}</a>`;
};

const NAV = ["/", "/blog", "/podcast", "/community", "/gallery", "/pricing", "/help-center"];

const ICONS = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9a14 14 0 0 1 0 14.2M19.1 4.9a14 14 0 0 0 0 14.2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
};

const groups = [
  { title: "Watch", paths: ["/metsxmfanzone", "/gameday-live", "/replay-games", "/broadcast-schedule", "/tv"] },
  { title: "Read", paths: ["/blog", "/mets-game-recaps", "/mets-scores", "/mets-schedule-2026", "/mets-roster"] },
  { title: "Community", paths: ["/community", "/podcast", "/gallery", "/social", "/events"] },
  { title: "Support", paths: ["/help-center", "/faqs", "/contact", "/privacy", "/terms"] },
];

const footer = () => `
  <footer class="site-footer">
    <div class="content-width">
      <div class="footer-grid">
        ${groups
          .map(
            (g) => `<div><h4>${esc(g.title)}</h4>${g.paths
              .filter((p) => byPath.has(p))
              .map((p) => link(p))
              .join("")}</div>`
          )
          .join("")}
      </div>
      <p class="footer-note">&copy; ${new Date().getFullYear()} MetsXMFanZone. Fan-run coverage of the New York Mets. Not affiliated with MLB or the New York Mets.</p>
    </div>
  </footer>`;

const header = (currentPath) => `
  <header class="site-header">
    <div class="content-width header-inner">
      <a class="brand" href="index.html">${ICONS.logo}<span>MetsXMFanZone</span></a>
      <nav class="primary-nav" aria-label="Main">
        ${NAV.filter((p) => byPath.has(p))
          .map((p) => {
            const e = byPath.get(p);
            return `<a href="${fileFor(p)}"${p === currentPath ? ' aria-current="page"' : ""}>${esc(e.label)}</a>`;
          })
          .join("")}
      </nav>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav">${ICONS.menu}<span>Menu</span></button>
    </div>
    <nav class="mobile-nav content-width" id="mobile-nav" aria-label="Mobile">
      ${registry
        .slice(0, 24)
        .map((e) => `<a href="${fileFor(e.path)}">${esc(e.label)}</a>`)
        .join("")}
    </nav>
  </header>`;

const related = (currentPath) => {
  const picks = registry.filter((e) => e.path !== currentPath).slice(0, 8);
  return `
  <section class="section content-width">
    <h2>Explore more</h2>
    <div class="card-grid">
      ${picks
        .map(
          (e) => `<a class="card" href="${fileFor(e.path)}">
            <span class="tag">${esc(e.label)}</span>
            <h3>${esc(e.title.split("|")[0].trim())}</h3>
            <p>${esc(e.description.slice(0, 110))}…</p>
          </a>`
        )
        .join("")}
    </div>
  </section>`;
};

const FAQS = [
  ["What does a MetsXMFanZone membership include?", "Live game streams, replays, member-only podcasts, and full access to the community feed."],
  ["Can I read articles without an account?", "Yes. Every published article is free to read and free to share."],
  ["How do I cancel?", "Open your account page and choose Cancel membership. Access continues until the end of the paid period."],
  ["Which devices are supported?", "Phones, tablets, laptops, and TVs through casting or AirPlay."],
];

const contactForm = `
  <form class="prose" data-static-form>
    <p><label>Your name<br><input name="name" required style="width:100%;padding:.55rem;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:inherit"></label></p>
    <p><label>Email<br><input type="email" name="email" required style="width:100%;padding:.55rem;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:inherit"></label></p>
    <p><label>Message<br><textarea name="message" rows="5" required style="width:100%;padding:.55rem;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:inherit"></textarea></label></p>
    <button class="button primary" type="submit">Send message</button>
    <p class="form-note" style="color:var(--muted);font-size:.85rem"></p>
  </form>`;

const extraFor = (p) => {
  if (p === "/faqs" || p === "/help-center") {
    return `<section class="section content-width">
      <h2>Common questions</h2>
      ${FAQS.map(
        (f, i) => `<div class="accordion">
          <button class="accordion-trigger" type="button" aria-expanded="false" aria-controls="faq-${i}">${esc(f[0])}${ICONS.chevron}</button>
          <div class="accordion-panel" id="faq-${i}" hidden>${esc(f[1])}</div>
        </div>`
      ).join("")}
    </section>`;
  }
  if (p === "/contact" || p === "/feedback" || p === "/business-partner" || p === "/podcaster-application") {
    return `<section class="section content-width"><h2>Get in touch</h2>${contactForm}</section>`;
  }
  return "";
};

const page = (entry) => {
  const file = fileFor(entry.path);
  const canonical = `${SITE_URL}${entry.path}`;
  const image = imageFor(entry);
  const heading = entry.title.split("|")[0].trim();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(entry.title)}</title>
<meta name="description" content="${esc(entry.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:site_name" content="MetsXMFanZone">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(entry.title)}">
<meta property="og:description" content="${esc(entry.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(heading)} — MetsXMFanZone">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@metsxmfanzone">
<meta name="twitter:title" content="${esc(entry.title)}">
<meta name="twitter:description" content="${esc(entry.description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${header(entry.path)}
<main id="main">
  <section class="hero content-width">
    <p class="eyebrow">${esc(entry.label)}</p>
    <h1>${esc(heading)}</h1>
    <p class="lead">${esc(entry.description)}</p>
    <div class="actions">
      <a class="button primary" href="${fileFor("/pricing")}">Become a member</a>
      <a class="button secondary" href="${fileFor("/blog")}">Latest Mets news</a>
    </div>
  </section>
  <section class="section content-width">
    <img class="share-image" src="${esc(image)}" alt="${esc(heading)}" loading="lazy" width="1200" height="630">
  </section>
  ${extraFor(entry.path)}
  ${related(entry.path)}
</main>
${footer()}
<button class="to-top" type="button" aria-label="Back to top">${ICONS.up}</button>
<script src="app.js"></script>
</body>
</html>
`;
};

await mkdir(OUT, { recursive: true });
let count = 0;
for (const entry of registry) {
  await writeFile(path.join(OUT, fileFor(entry.path)), page(entry), "utf8");
  count += 1;
}

// 404 page
await writeFile(
  path.join(OUT, "404.html"),
  page({
    path: "/404",
    label: "404",
    title: "Page Not Found | MetsXMFanZone",
    description: "That page does not exist. Head back to the home page or browse the latest Mets news.",
    image: "/share/home.jpg",
  }).replace('content="index, follow, max-image-preview:large"', 'content="noindex, nofollow"'),
  "utf8"
);

console.log(`Wrote ${count + 1} pages to static-site/`);
