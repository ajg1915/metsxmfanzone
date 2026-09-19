/**
 * prerender-seo.mjs
 *
 * Dependency-free SEO prerenderer for this Vite SPA.
 *
 * It "tricks" the SPA: for every public route (and every published blog post)
 * it writes a real static HTML file into dist/ that contains
 *   - full <head> metadata (title, description, canonical, OpenGraph, Twitter, JSON-LD)
 *   - crawler-visible markup inside <div id="root">
 * React then mounts over that markup on the client, so humans get the normal
 * app while crawlers (Google, Facebook, X, iMessage, Iframely) get real HTML.
 *
 * Usage:
 *   node prerender-seo.mjs            # after `vite build`
 *   node prerender-seo.mjs --quiet
 *
 * Safe to run repeatedly; it always rebuilds from dist/index.html.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, 'dist');
const templatePath = path.join(distDir, 'index.html');

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://metsxmfanzone.com').replace(/\/$/, '');
const SITE_NAME = 'MetsXMFanZone';

// Owner-managed backend (must match vite.config.ts) — never read from env,
// so a stale build env can't point the prerenderer at a retired project.
const SUPABASE_URL = 'https://rdmrxeplasttewtlfetc.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA';

const OLD_STORAGE_HOST = 'clwghkbtkofacsjeyrtk.supabase.co';
const NEW_STORAGE_HOST = 'rdmrxeplasttewtlfetc.supabase.co';
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

const quiet = process.argv.includes('--quiet');
const log = (...a) => { if (!quiet) console.log('[prerender-seo]', ...a); };

/* ---------------------------------- utils --------------------------------- */

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const stripTags = (v) => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const clamp = (v, n) => {
  const s = stripTags(v);
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

function absoluteImage(url) {
  if (!url) return FALLBACK_IMAGE;
  let u = String(url).split(OLD_STORAGE_HOST).join(NEW_STORAGE_HOST);
  if (u.startsWith('data:')) return FALLBACK_IMAGE;
  if (u.startsWith('http://')) return `https://${u.slice(7)}`;
  if (u.startsWith('https://')) return u;
  return `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}

/** Remove the template's own social/SEO tags so ours are the only ones. */
function stripTemplateHead(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\s+name="(title|description|keywords|author)"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="article:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '');
}

/* ------------------------------ head builder ------------------------------ */

function buildHead({ title, description, canonical, image, imageAlt, type = 'website', article, jsonLd }) {
  const t = esc(title);
  const d = esc(clamp(description, 200));
  const img = esc(absoluteImage(image));
  const rows = [
    `<title>${t}</title>`,
    `<meta name="title" content="${t}" />`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:secure_url" content="${img}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:type" content="${img.endsWith('.png') ? 'image/png' : 'image/jpeg'}" />`,
    `<meta property="og:image:alt" content="${esc(imageAlt || title)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<meta name="twitter:image:alt" content="${esc(imageAlt || title)}" />`,
  ];

  if (article) {
    if (article.publishedAt) rows.push(`<meta property="article:published_time" content="${esc(article.publishedAt)}" />`);
    if (article.updatedAt) rows.push(`<meta property="article:modified_time" content="${esc(article.updatedAt)}" />`);
    if (article.author) rows.push(`<meta property="article:author" content="${esc(article.author)}" />`);
    if (article.section) rows.push(`<meta property="article:section" content="${esc(article.section)}" />`);
  }

  if (jsonLd) {
    rows.push(
      `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    );
  }

  return rows.join('\n    ');
}

/* ------------------------------ body builder ------------------------------ */

/** Crawler-visible markup placed inside #root. React replaces it on mount. */
function articleBody(post, canonical) {
  const image = absoluteImage(post.featured_image_url || post.image_url || post.cover_image);
  const date = post.published_at || post.created_at;
  const body = String(post.content || post.body || '')
    .split(/\n{2,}/)
    .map((p) => stripTags(p))
    .filter(Boolean)
    .slice(0, 40)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('\n        ');

  return `<article itemscope itemtype="https://schema.org/NewsArticle">
        <h1 itemprop="headline">${esc(post.title)}</h1>
        ${date ? `<time itemprop="datePublished" datetime="${esc(date)}">${esc(new Date(date).toDateString())}</time>` : ''}
        ${post.author ? `<p itemprop="author">${esc(post.author)}</p>` : ''}
        <img src="${esc(image)}" alt="${esc(post.title)}" itemprop="image" width="1200" height="630" />
        <p itemprop="description">${esc(clamp(post.excerpt || post.description || post.content, 300))}</p>
        <div itemprop="articleBody">
        ${body}
        </div>
        <link itemprop="mainEntityOfPage" href="${esc(canonical)}" />
      </article>`;
}

function pageBody({ title, description, canonical }) {
  return `<main>
        <h1>${esc(title)}</h1>
        <p>${esc(clamp(description, 300))}</p>
        <p><a href="${esc(canonical)}">${esc(canonical)}</a></p>
      </main>`;
}

/* ------------------------------- html writer ------------------------------ */

function renderPage(template, { head, body }) {
  let html = stripTemplateHead(template);
  html = html.replace(/<\/head>/i, `    ${head}\n  </head>`);

  // Inject crawler markup into the (empty) app container.
  html = html.replace(
    /(<div id="root"[^>]*>)([\s\S]*?)(<\/div>)/i,
    (match, open, inner, close) => (stripTags(inner) ? match : `${open}\n      ${body}\n    ${close}`)
  );

  return html;
}

function writeRoute(routePath, html) {
  const clean = routePath.replace(/^\/+|\/+$/g, '');
  const outDir = clean ? path.join(distDir, clean) : distDir;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
}

/* --------------------------------- routes --------------------------------- */

const STATIC_ROUTES = [
  ['/', 'MetsXMFanZone — #1 New York Mets Fan Community', 'Live games, podcasts, news, highlights, and the most passionate New York Mets fan community. Built by fans, for fans.'],
  ['/blog', 'Mets Blog — News, Analysis & Trade Rumors | MetsXMFanZone', 'The latest New York Mets news, analysis, trade rumors, and feature articles from the MetsXMFanZone editorial team.'],
  ['/podcast', 'Mets Podcast — The MetsXMFanZone Show', 'Game recaps, interviews, and unfiltered Mets fan takes every week on the official MetsXMFanZone podcast.'],
  ['/community', 'Mets Fan Community — Join the Conversation | MetsXMFanZone', 'Connect with thousands of New York Mets fans. Share your takes, photos, and game-day reactions.'],
  ['/plans', 'Premium Membership Plans | MetsXMFanZone', 'Unlock live streams, exclusive content, and ad-free browsing with a Premium or Annual membership.'],
  ['/pricing', 'Pricing & Plans | MetsXMFanZone', 'Choose the MetsXMFanZone plan that fits you — every plan unlocks live games and exclusive content.'],
  ['/shop', 'Mets Fan Shop — Gear & Merchandise | MetsXMFanZone', 'Shop curated New York Mets gear, apparel, and exclusive MetsXMFanZone merchandise.'],
  ['/gallery', 'Mets Photo Gallery | MetsXMFanZone', 'Fan photos, game-day moments, and Mets memorabilia from the MetsXMFanZone community.'],
  ['/mets-roster', '2026 New York Mets Roster | MetsXMFanZone', 'Complete 2026 New York Mets roster, lineup, and player stats — updated for the regular season.'],
  ['/mets-schedule-2026', '2026 Mets Schedule & Game Times | MetsXMFanZone', 'Full 2026 New York Mets schedule with game times, opponents, and matchup analysis.'],
  ['/mets-history', 'New York Mets History | MetsXMFanZone', 'Relive the greatest moments in New York Mets history — championships, legends, unforgettable seasons.'],
  ['/mets-scores', 'Mets Scores & Results | MetsXMFanZone', 'Latest New York Mets scores, results, and box scores — updated in real time.'],
  ['/nl-scores', 'National League Scores | MetsXMFanZone', 'Live National League scores and standings, with focus on the NL East race.'],
  ['/player-stats', '2026 Mets Player Stats | MetsXMFanZone', 'Complete 2026 New York Mets player statistics — batting, pitching, and fielding.'],
  ['/replay-games', 'Mets Replay Games | MetsXMFanZone', 'Watch full replays of recent New York Mets games on MetsXMFanZone.'],
  ['/video-gallery', 'Mets Video Gallery | MetsXMFanZone', 'Highlights, interviews, and fan videos from around the New York Mets universe.'],
  ['/metsxmfanzone', 'MetsXMFanZone Network', 'The MetsXMFanZone broadcast network — fan-driven coverage of every Mets game, all season long.'],
  ['/mlb-network', 'MLB Network on MetsXMFanZone', 'MLB Network programming, schedules, and Mets-related coverage.'],
  ['/msg-network', 'MSG Network on MetsXMFanZone', 'MSG Network broadcasts and Mets coverage on MetsXMFanZone.'],
  ['/espn-network', 'ESPN Network on MetsXMFanZone', 'ESPN Mets coverage, Sunday Night Baseball, and analysis.'],
  ['/pix11-network', 'PIX11 Network on MetsXMFanZone', 'PIX11 Mets coverage and New York sports news.'],
  ['/spring-training-live', 'Mets Spring Training Live | MetsXMFanZone', 'Live coverage of New York Mets Spring Training from Port St. Lucie.'],
  ['/help-center', 'Help Center | MetsXMFanZone', 'Answers, guides, and support for everything MetsXMFanZone — from streaming to memberships.'],
  ['/faqs', 'Frequently Asked Questions | MetsXMFanZone', 'Common questions about MetsXMFanZone memberships, streaming, and account access.'],
  ['/contact', 'Contact Us | MetsXMFanZone', 'Get in touch with the MetsXMFanZone team for support, partnerships, or feedback.'],
  ['/feedback', 'Send Us Feedback | MetsXMFanZone', 'Share your feedback, ideas, and suggestions to help us improve MetsXMFanZone.'],
  ['/business-partner', 'Become a Business Partner | MetsXMFanZone', 'Promote your business to the most engaged New York Mets fan audience.'],
  ['/install', 'Install the MetsXMFanZone App', 'Install MetsXMFanZone on iOS and Android for live games, news, and notifications.'],
  ['/whats-new', "What's New | MetsXMFanZone", 'The latest features, improvements, and updates rolling out across MetsXMFanZone.'],
  ['/privacy', 'Privacy Policy | MetsXMFanZone', 'How MetsXMFanZone collects, uses, and protects your information.'],
  ['/terms', 'Terms of Service | MetsXMFanZone', 'The terms governing use of the MetsXMFanZone website, streams, and community features.'],
];

/* --------------------------------- data ----------------------------------- */

async function fetchPublishedPosts() {
  const url =
    `${SUPABASE_URL}/rest/v1/blog_posts` +
    `?select=slug,title,excerpt,meta_description,content,featured_image_url,published_at,created_at,updated_at,category` +
    `&published=eq.true&order=published_at.desc&limit=500`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows.filter((r) => r?.slug && String(r.slug).trim()) : [];
  } catch (err) {
    log(`WARN could not load blog posts (${err.message}) — static routes only`);
    return [];
  }
}

/* -------------------------------- sitemap --------------------------------- */

function writeSitemap(urls) {
  const body = urls
    .map(
      ({ loc, lastmod, priority }) =>
        `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${esc(lastmod)}</lastmod>` : ''}<changefreq>daily</changefreq><priority>${priority}</priority></url>`
    )
    .join('\n');
  const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${ns}">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
  log(`sitemap.xml → ${urls.length} urls`);
}

/* -------------------------------- robots.txt ------------------------------ */

function writeRobotsTxt() {
  const lines = [
    '# MetsXMFanZone robots.txt',
    '# Generated by prerender-seo.mjs during the SEO build — edit that script, not this file.',
    '',
    '# Search engines',
    'User-agent: Googlebot',
    'Allow: /',
    'Crawl-delay: 1',
    '',
    'User-agent: Googlebot-Image',
    'Allow: /',
    '',
    'User-agent: Googlebot-Video',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    'Crawl-delay: 1',
    '',
    'User-agent: Slurp',
    'Allow: /',
    'Crawl-delay: 1',
    '',
    'User-agent: DuckDuckBot',
    'Allow: /',
    'Crawl-delay: 1',
    '',
    'User-agent: Baiduspider',
    'Allow: /',
    'Crawl-delay: 2',
    '',
    'User-agent: YandexBot',
    'Allow: /',
    'Crawl-delay: 2',
    '',
    '# Social media crawlers',
    'User-agent: Twitterbot',
    'Allow: /',
    '',
    'User-agent: facebookexternalhit',
    'Allow: /',
    '',
    'User-agent: LinkedInBot',
    'Allow: /',
    '',
    'User-agent: Pinterest',
    'Allow: /',
    '',
    'User-agent: Discordbot',
    'Allow: /',
    '',
    'User-agent: Slackbot',
    'Allow: /',
    '',
    'User-agent: WhatsApp',
    'Allow: /',
    '',
    'User-agent: TelegramBot',
    'Allow: /',
    '',
    '# All other bots',
    'User-agent: *',
    'Allow: /',
    'Crawl-delay: 2',
    '',
    '# Private / admin areas',
    'Disallow: /admin',
    'Disallow: /admin/*',
    'Disallow: /api/',
    'Disallow: /dashboard',
    'Disallow: /*.json$',
    'Disallow: /auth',
    'Disallow: /logout',
    'Disallow: /confirm-account',
    'Disallow: /payment-success',
    'Disallow: /payment-error',
    'Disallow: /paypal-success',
    'Disallow: /helcim-checkout',
    'Disallow: /writer-auth',
    'Disallow: /writer-register',
    'Disallow: /admin-setup',
    '',
    '# Allow specific public JSON files',
    'Allow: /manifest.json',
    '',
    '# Sitemaps',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    'Sitemap: https://rdmrxeplasttewtlfetc.supabase.co/functions/v1/dynamic-sitemap',
    '',
    `Host: ${SITE_URL}`,
    '',
  ];
  fs.writeFileSync(path.join(distDir, 'robots.txt'), lines.join('\n'), 'utf8');
  log(`robots.txt → sitemap ${SITE_URL}/sitemap.xml`);
}

/* ---------------------------------- main ---------------------------------- */

async function main() {
  if (!fs.existsSync(templatePath)) {
    console.error('[prerender-seo] dist/index.html not found — run `vite build` first.');
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  const sitemap = [];
  let written = 0;

  // 1. Static public routes
  for (const [routePath, title, description] of STATIC_ROUTES) {
    const canonical = routePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${routePath}`;
    const head = buildHead({
      title,
      description,
      canonical,
      image: FALLBACK_IMAGE,
      jsonLd:
        routePath === '/'
          ? {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: SITE_NAME,
              url: `${SITE_URL}/`,
              logo: FALLBACK_IMAGE,
            }
          : { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: canonical },
    });
    writeRoute(routePath, renderPage(template, { head, body: pageBody({ title, description, canonical }) }));
    sitemap.push({ loc: canonical, priority: routePath === '/' ? '1.0' : '0.7' });
    written++;
  }

  // 2. Every published blog post
  const posts = await fetchPublishedPosts();
  for (const post of posts) {
    const slug = String(post.slug).trim();
    const canonical = `${SITE_URL}/blog/${slug}`;
    const image = absoluteImage(post.featured_image_url);
    const description = post.meta_description || post.excerpt || clamp(post.content, 200);
    const head = buildHead({
      title: `${post.title} | ${SITE_NAME}`,
      description,
      canonical,
      image,
      imageAlt: post.title,
      type: 'article',
      article: {
        publishedAt: post.published_at || post.created_at,
        updatedAt: post.updated_at,
        author: post.author,
        section: post.category || 'New York Mets',
      },
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: post.title,
        description: stripTags(description),
        image: [image],
        datePublished: post.published_at || post.created_at,
        dateModified: post.updated_at || post.published_at || post.created_at,
        author: { '@type': 'Person', name: post.author || SITE_NAME },
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: FALLBACK_IMAGE } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      },
    });
    writeRoute(`/blog/${slug}`, renderPage(template, { head, body: articleBody(post, canonical) }));
    sitemap.push({
      loc: canonical,
      lastmod: (post.updated_at || post.published_at || post.created_at || '').slice(0, 10) || undefined,
      priority: '0.9',
    });
    written++;
  }

  writeSitemap(sitemap);
  writeRobotsTxt();
  log(`done — ${written} pages (${posts.length} articles) written to dist/`);
}

main().catch((err) => {
  console.error('[prerender-seo] failed:', err);
  process.exit(1);
});
