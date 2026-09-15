import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, 'dist');
const templatePath = path.resolve(distDir, 'index.html');

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://metsxmfanzone.com';
// Owner-managed Supabase backend override (must match vite.config.ts) so the
// prerenderer always reads live content from the owner's project, never from
// any stale VITE_/SUPABASE_ env values left in the build environment.
const SUPABASE_URL = 'https://rdmrxeplasttewtlfetc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA';
const FALLBACK_IMAGE = `${SITE_URL}/og-image.jpg`;
const SOCIAL_IMAGE = `${SITE_URL}/og-image.jpg`;

function escapeHtml(input) {
  return String(input ?? '').replace(/[&<>"']/g, (match) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match] || match
  ));
}

function stripHtml(input) {
  return String(input ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveImage(url) {
  if (!url) return FALLBACK_IMAGE;
  // Rewrite storage URLs from the retired Lovable Cloud project to the
  // current owner backend (same objects were migrated across).
  url = String(url).replace(
    'clwghkbtkofacsjeyrtk.supabase.co',
    'rdmrxeplasttewtlfetc.supabase.co'
  );
  if (url.startsWith('data:')) return FALLBACK_IMAGE;
  if (url.startsWith('http://')) return `https://${url.slice(7)}`;
  if (url.startsWith('https://')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function stripTemplateSocialTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\s+name="title"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="keywords"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="fb:app_id"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, '');
}

// ---------- Static route registry ----------
// Curated list of public, indexable routes. Auth/admin/live/dashboard/realtime omitted intentionally.
const LEGACY_STATIC_ROUTES = [
  { path: '/', title: 'MetsXMFanZone — #1 New York Mets Fan Community', description: 'Live games, podcasts, news, highlights, and the most passionate New York Mets fan community. Built by fans, for fans.', keywords: 'New York Mets, Mets fan community, Mets live games, Mets news, Mets podcasts, MLB, baseball, Citi Field' },
  { path: '/blog', title: 'Mets Blog — News, Analysis & Trade Rumors | MetsXMFanZone', description: 'The latest New York Mets news, analysis, trade rumors, and feature articles from the MetsXMFanZone editorial team.', keywords: 'Mets news, Mets blog, Mets analysis, Mets trade rumors, MLB articles' },
  { path: '/podcast', title: 'Mets Podcast — The MetsXMFanZone Show', description: 'Listen to the official MetsXMFanZone podcast. Game recaps, interviews, and unfiltered Mets fan takes every week.', keywords: 'Mets podcast, MetsXMFanZone podcast, Mets show, MLB podcast' },
  { path: '/community', title: 'Mets Fan Community — Join the Conversation | MetsXMFanZone', description: 'Connect with thousands of New York Mets fans. Share your takes, photos, and game-day reactions in the MetsXMFanZone community.', keywords: 'Mets fan community, Mets fans, Mets forum, Mets social' },
  { path: '/plans', title: 'Premium Membership Plans | MetsXMFanZone', description: 'Unlock live streams, exclusive content, and ad-free browsing with a MetsXMFanZone Premium or Annual membership.', keywords: 'Mets premium, MetsXMFanZone membership, Mets streaming subscription' },
  { path: '/pricing', title: 'Pricing & Plans | MetsXMFanZone', description: 'Choose the MetsXMFanZone plan that fits you. Premium monthly or Annual savings — every plan unlocks live games and exclusive content.', keywords: 'MetsXMFanZone pricing, Mets subscription, Mets streaming plans' },
  { path: '/shop', title: 'Mets Fan Shop — Gear & Merchandise | MetsXMFanZone', description: 'Shop officially curated New York Mets gear, apparel, and exclusive MetsXMFanZone merchandise.', keywords: 'Mets shop, Mets gear, Mets merchandise, MetsXMFanZone store' },
  { path: '/gallery', title: 'Mets Photo Gallery | MetsXMFanZone', description: 'Browse the best fan photos, game-day moments, and Mets memorabilia from the MetsXMFanZone community.', keywords: 'Mets photos, Mets gallery, Citi Field photos' },
  { path: '/mets-roster', title: '2026 New York Mets Roster | MetsXMFanZone', description: 'Complete 2026 New York Mets roster, lineup, and player stats — updated for the regular season.', keywords: 'Mets roster 2026, Mets lineup, Mets players' },
  { path: '/mets-schedule-2026', title: '2026 Mets Schedule & Game Times | MetsXMFanZone', description: 'Full 2026 New York Mets schedule. Find game times, opponents, and matchup analysis for every game.', keywords: 'Mets schedule 2026, Mets games, Mets calendar' },
  { path: '/mets-history', title: 'New York Mets History | MetsXMFanZone', description: 'Relive the greatest moments in New York Mets history — championships, legends, and unforgettable seasons.', keywords: 'Mets history, Mets championships, 1969 Mets, 1986 Mets' },
  { path: '/spring-training-live', title: 'Mets Spring Training Live | MetsXMFanZone', description: 'Live coverage of New York Mets Spring Training. Schedules, results, and player updates from Port St. Lucie.', keywords: 'Mets spring training, Port St Lucie, Mets preseason' },
  { path: '/help-center', title: 'Help Center | MetsXMFanZone', description: 'Find answers, guides, and support for everything MetsXMFanZone — from streaming to memberships.', keywords: 'MetsXMFanZone help, support, customer service' },
  { path: '/faqs', title: 'Frequently Asked Questions | MetsXMFanZone', description: 'Answers to the most common questions about MetsXMFanZone memberships, streaming, and account access.', keywords: 'MetsXMFanZone FAQ, Mets streaming questions' },
  { path: '/contact', title: 'Contact Us | MetsXMFanZone', description: 'Get in touch with the MetsXMFanZone team for support, partnerships, or feedback.', keywords: 'MetsXMFanZone contact, support, partnerships' },
  { path: '/feedback', title: 'Send Us Feedback | MetsXMFanZone', description: 'Share your feedback, ideas, and suggestions to help us make MetsXMFanZone even better.', keywords: 'MetsXMFanZone feedback, suggestions' },
  { path: '/business-partner', title: 'Become a Business Partner | MetsXMFanZone', description: 'Promote your business to the most engaged New York Mets fan audience. Partner with MetsXMFanZone today.', keywords: 'Mets advertising, MetsXMFanZone partners, sponsorship' },
  { path: '/privacy', title: 'Privacy Policy | MetsXMFanZone', description: 'Read the MetsXMFanZone privacy policy. Learn how we collect, use, and protect your information.', keywords: 'privacy policy' },
  { path: '/terms', title: 'Terms of Service | MetsXMFanZone', description: 'Read the MetsXMFanZone terms of service governing the use of our website, streams, and community features.', keywords: 'terms of service' },
  { path: '/install', title: 'Install the MetsXMFanZone App | MetsXMFanZone', description: 'Install MetsXMFanZone on iOS and Android for the fastest access to live games, news, and notifications.', keywords: 'Mets app, MetsXMFanZone install, PWA' },
  { path: '/whats-new', title: "What's New | MetsXMFanZone", description: 'See the latest features, improvements, and updates rolling out across MetsXMFanZone.', keywords: 'MetsXMFanZone updates, changelog, new features' },
  { path: '/metsxmfanzone', title: 'MetsXMFanZone Network | MetsXMFanZone', description: 'The MetsXMFanZone broadcast network — fan-driven coverage of every Mets game, all season long.', keywords: 'MetsXMFanZone network, Mets broadcast' },
  { path: '/mlb-network', title: 'MLB Network on MetsXMFanZone', description: 'MLB Network programming, schedules, and Mets-related coverage — all on MetsXMFanZone.', keywords: 'MLB Network, Mets broadcasts' },
  { path: '/msg-network', title: 'MSG Network on MetsXMFanZone', description: 'MSG Network broadcasts and Mets coverage on MetsXMFanZone.', keywords: 'MSG Network, Mets broadcasts' },
  { path: '/espn-network', title: 'ESPN Network on MetsXMFanZone', description: 'ESPN Mets coverage, Sunday Night Baseball, and analysis — featured on MetsXMFanZone.', keywords: 'ESPN, Sunday Night Baseball, Mets' },
  { path: '/pix11-network', title: 'PIX11 Network on MetsXMFanZone', description: 'PIX11 Mets coverage and New York sports news — featured on MetsXMFanZone.', keywords: 'PIX11, New York Mets news' },
  { path: '/mets-scores', title: 'Mets Scores & Results | MetsXMFanZone', description: 'Latest New York Mets scores, results, and box scores — updated in real time.', keywords: 'Mets scores, Mets results, Mets box score' },
  { path: '/nl-scores', title: 'National League Scores | MetsXMFanZone', description: 'Live National League scores and standings, with focus on the NL East race.', keywords: 'NL scores, NL East standings, MLB scores' },
  { path: '/player-stats', title: '2026 Mets Player Stats | MetsXMFanZone', description: 'Complete 2026 New York Mets player statistics — batting, pitching, and fielding.', keywords: 'Mets stats, Mets player statistics 2026' },
  { path: '/replay-games', title: 'Mets Replay Games | MetsXMFanZone', description: 'Watch full replays of recent New York Mets games on MetsXMFanZone.', keywords: 'Mets replays, full game replay' },
  { path: '/video-gallery', title: 'Mets Video Gallery | MetsXMFanZone', description: 'Watch the best Mets highlights, interviews, and fan videos all in one place.', keywords: 'Mets videos, Mets highlights' },
  { path: '/social-hub', title: 'Mets Social Hub | MetsXMFanZone', description: 'Follow MetsXMFanZone across X, TikTok, Instagram, YouTube, and more — all from one hub.', keywords: 'Mets social media, MetsXMFanZone social' },
  { path: '/tv-broadcast-schedule', title: 'Mets TV Broadcast Schedule | MetsXMFanZone', description: 'Full TV and streaming broadcast schedule for every New York Mets game.', keywords: 'Mets TV schedule, where to watch Mets' },
  { path: '/events', title: 'Mets Fan Events | MetsXMFanZone', description: 'Upcoming MetsXMFanZone fan events, watch parties, and meetups.', keywords: 'Mets fan events, watch party' },
];

const sharePages = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'src/data/share-pages.json'), 'utf-8')
);
const STATIC_ROUTES = sharePages.map((page) => ({
  ...page,
  image: resolveImage(page.image),
}));

function buildHead({ title, description, keywords, canonical, image, type = 'website', extraJsonLd }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const img = image || SOCIAL_IMAGE;
  const imageType = /\.png(?:$|\?)/i.test(img) ? 'image/png' : /\.webp(?:$|\?)/i.test(img) ? 'image/webp' : 'image/jpeg';

  return `
    <title>${safeTitle}</title>
    <meta name="title" content="${safeTitle}" />
    <meta name="description" content="${safeDesc}" />
    ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : ''}
    <link rel="canonical" href="${canonical}" />

    <meta property="fb:app_id" content="1151558476948104" />
    <meta property="og:type" content="${type}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="MetsXMFanZone" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:secure_url" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="${imageType}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:locale" content="en_US" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@metsxmfanzone" />
    <meta name="twitter:creator" content="@metsxmfanzone" />
    <meta name="twitter:domain" content="metsxmfanzone.com" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${img}" />
    <meta name="twitter:image:alt" content="${safeTitle}" />
    ${extraJsonLd ? `<script type="application/ld+json">${JSON.stringify(extraJsonLd)}</script>` : ''}
  `.trim();
}

// Replaces the SPA root markup with server-visible article content so crawlers,
// link previewers and reader views read the article — not the leftover markup
// inherited from the build template — before JavaScript runs.
function injectBody(html, bodyHtml) {
  if (!bodyHtml) return html;
  const openMatch = html.match(/<div id="root"[^>]*>/);
  if (!openMatch) return html;
  const openIdx = html.indexOf(openMatch[0]);
  const contentStart = openIdx + openMatch[0].length;
  // Walk nested <div> tags to find the matching closing tag for #root.
  const tagRe = /<div\b[^>]*>|<\/div>/gi;
  tagRe.lastIndex = contentStart;
  let depth = 1;
  let endIdx = -1;
  let m;
  while ((m = tagRe.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) {
      endIdx = m.index;
      break;
    }
  }
  if (endIdx === -1) return html;
  return html.slice(0, contentStart) + bodyHtml + html.slice(endIdx);
}


function buildArticleBody({ title, image, description, contentHtml, publishedTime, canonical, author = 'MetsXMFanZone' }) {
  const safeTitle = escapeHtml(title || '');
  const body = contentHtml && String(contentHtml).trim().length > 0
    ? String(contentHtml)
    : `<p>${escapeHtml(description || '')}</p>`;
  return [
    '<article>',
    `<h1>${safeTitle}</h1>`,
    publishedTime ? `<p><time datetime="${escapeHtml(publishedTime)}">${escapeHtml(String(publishedTime).slice(0, 10))}</time> · ${escapeHtml(author)}</p>` : '',
    image ? `<p><img src="${escapeHtml(image)}" alt="${safeTitle}" width="1200" height="630" /></p>` : '',
    description ? `<p>${escapeHtml(description)}</p>` : '',
    `<div>${body}</div>`,
    canonical ? `<p><a href="${escapeHtml(canonical)}">${safeTitle}</a></p>` : '',
    '</article>',
  ].filter(Boolean).join('\n');
}

function buildBlogBody(post) {
  const rawDescription =
    (post.excerpt && String(post.excerpt).trim().length > 0
      ? String(post.excerpt)
      : stripHtml(post.content || '')) || String(post.title || '');
  return buildArticleBody({
    title: post.title,
    image: resolveImage(post.featured_image_url),
    description: rawDescription.length > 300 ? `${rawDescription.slice(0, 297)}...` : rawDescription,
    contentHtml: post.content || '',
    publishedTime: post.published_at,
    canonical: `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`,
  });
}

function writeHtmlForRoute(template, routePath, headHtml, bodyHtml) {
  const stripped = stripTemplateSocialTags(template);
  const html = injectBody(stripped.replace('</head>', `${headHtml}\n</head>`), bodyHtml);
  // Root route -> dist/index.html (overwrite). Others -> dist/<path>/index.html
  const rel = routePath === '/' ? '' : routePath.replace(/^\/+|\/+$/g, '');
  const filePath = rel
    ? path.resolve(distDir, rel, 'index.html')
    : path.resolve(distDir, 'index.html');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
  console.log(`✓ Prerendered ${routePath}`);
}


// ---------- Blog posts ----------
function buildBlogHead(post) {
  const slug = encodeURIComponent(post.slug);
  const postUrl = `${SITE_URL}/blog/${slug}`;
  const socialImage = resolveImage(post.featured_image_url);
  const rawDescription =
    (post.excerpt && String(post.excerpt).trim().length > 0
      ? String(post.excerpt)
      : stripHtml(post.content || '')) || String(post.title || '');
  const description = rawDescription.length > 160 ? `${rawDescription.slice(0, 157)}...` : rawDescription;
  const keywords = [post.category, ...(Array.isArray(post.tags) ? post.tags : [])]
    .map((v) => String(v || '').trim()).filter(Boolean).join(', ');
  const socialTitle = `${post.title} | MetsXMFanZone`;
  const publishedTime = post.published_at || new Date().toISOString();
  const modifiedTime = post.updated_at || publishedTime;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description,
    image: [socialImage],
    datePublished: publishedTime,
    dateModified: modifiedTime,
    author: { '@type': 'Organization', name: 'MetsXMFanZone', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'MetsXMFanZone',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo-512.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    articleSection: post.category || undefined,
    keywords: keywords || undefined,
  };

  const tagsMeta = (Array.isArray(post.tags) ? post.tags : [])
    .map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`).join('\n    ');

  return `
    ${buildHead({ title: socialTitle, description, keywords, canonical: postUrl, image: socialImage, type: 'article', extraJsonLd: articleSchema })}
    <meta property="article:published_time" content="${escapeHtml(publishedTime)}" />
    <meta property="article:modified_time" content="${escapeHtml(modifiedTime)}" />
    <meta property="article:section" content="${escapeHtml(post.category || '')}" />
    <meta property="article:author" content="MetsXMFanZone" />
    ${tagsMeta}
  `.trim();
}

async function fetchPublishedBlogPosts() {
  const query = new URLSearchParams({
    published: 'eq.true',
    select: 'slug,title,excerpt,content,featured_image_url,category,tags,published_at,updated_at',
    order: 'published_at.desc.nullslast',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?${query.toString()}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch published blog posts [${response.status}]: ${body}`);
  }
  return response.json();
}

async function fetchPublicRows(table, query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${table} [${response.status}]`);
  return response.json();
}

async function prerenderGameRecaps(template) {
  const query = new URLSearchParams({ status: 'eq.published', select: 'slug,title,summary,body,hero_image_url,published_at' });
  const recaps = await fetchPublicRows('game_recaps', query.toString());
  for (const recap of recaps) {
    const slug = String(recap.slug || '').trim();
    if (!slug || /\s/.test(slug)) continue;
    const canonical = `${SITE_URL}/mets-game-recaps/${encodeURIComponent(slug)}`;
    const description = String(recap.summary || stripHtml(recap.body || '') || recap.title).slice(0, 160);
    const head = buildHead({
      title: `${recap.title} | Mets Game Recap`, description, canonical,
      image: resolveImage(recap.hero_image_url || '/share/mets-game-recaps.jpg'), type: 'article',
      extraJsonLd: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: recap.title, description, image: [resolveImage(recap.hero_image_url || '/share/mets-game-recaps.jpg')], datePublished: recap.published_at, mainEntityOfPage: canonical },
    });
    writeHtmlForRoute(template, `/mets-game-recaps/${slug}`, head);
  }
  return recaps.length;
}

async function prerenderLiveStreams(template) {
  const query = new URLSearchParams({ select: 'id,title,description,thumbnail_url' });
  const streams = await fetchPublicRows('live_streams_public', query.toString());
  for (const stream of streams) {
    if (!stream.id) continue;
    const canonical = `${SITE_URL}/live/${stream.id}`;
    const title = `${stream.title} — Live Stream | MetsXMFanZone`;
    const description = String(stream.description || `Watch ${stream.title} live on MetsXMFanZone`).slice(0, 160);
    writeHtmlForRoute(template, `/live/${stream.id}`, buildHead({
      title, description, canonical,
      image: resolveImage(stream.thumbnail_url || '/share/metsxmfanzone.jpg'), type: 'video.other',
    }));
  }
  return streams.length;
}

// ---------- Matchups ----------
async function loadOpponentRegistry() {
  try {
    // Read TS as text and extract slugs via regex (avoid TS transpile in Node)
    const file = fs.readFileSync(
      path.resolve(__dirname, 'src/pages/matchups/opponentRegistry.ts'),
      'utf-8'
    );
    const matches = [...file.matchAll(/(\w+):\s*\{\s*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)"/g)];
    return matches.map((m) => ({ slug: m[2], name: m[3] }));
  } catch (e) {
    console.warn('Could not load opponent registry:', e.message);
    return [];
  }
}

// ---------- Sitemap ----------
function appendBlogUrlsToSitemap(posts) {
  const sitemapPath = path.resolve(distDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    console.warn('sitemap.xml not found in build output; skipping blog sitemap entries.');
    return;
  }
  let xml = fs.readFileSync(sitemapPath, 'utf-8');

  // Remove any previously generated block so re-runs stay idempotent.
  xml = xml.replace(/\n?  <!-- BLOG:START -->[\s\S]*?<!-- BLOG:END -->/g, '');

  const entries = [];
  for (const post of posts) {
    const slug = String(post?.slug ?? '').trim();
    if (!slug || /\s/.test(slug)) continue;
    const loc = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
    if (xml.includes(`<loc>${loc}</loc>`)) continue;
    const stamp = post.updated_at || post.published_at;
    const lastmod = stamp ? String(stamp).slice(0, 10) : null;
    entries.push(
      `  <url><loc>${loc}</loc>` +
      (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') +
      `<changefreq>weekly</changefreq><priority>0.7</priority></url>`
    );
  }

  if (entries.length === 0) return;
  const block = `\n  <!-- BLOG:START -->\n${entries.join('\n')}\n  <!-- BLOG:END -->\n`;
  xml = xml.replace('</urlset>', `${block}</urlset>`);
  fs.writeFileSync(sitemapPath, xml);
  console.log(`\u2713 Added ${entries.length} blog URL(s) to sitemap.xml`);
}

// ---------- Main ----------
async function prerenderAll() {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing build template at ${templatePath}. Run the client build first.`);
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  // 1. Static routes
  for (const route of STATIC_ROUTES) {
    const canonical = `${SITE_URL}${route.path === '/' ? '/' : route.path}`;
    const head = buildHead({
      title: route.title,
      description: route.description,
      keywords: route.keywords,
      canonical,
      image: route.image,
    });
    writeHtmlForRoute(template, route.path, head);
  }

  // 2. Matchup pages (programmatic SEO)
  const opponents = await loadOpponentRegistry();
  for (const opp of opponents) {
    const routePath = `/matchup/${opp.slug}`;
    const canonical = `${SITE_URL}${routePath}`;
    const title = `Mets vs ${opp.name} — 2026 Matchup Analysis | MetsXMFanZone`;
    const description = `Full breakdown of the New York Mets vs ${opp.name} matchup: lineups, pitching, betting lines, and head-to-head history for the 2026 season.`;
    const head = buildHead({
      title, description,
      keywords: `Mets vs ${opp.name}, ${opp.name} matchup, Mets betting, Mets 2026 matchup`,
      canonical,
    });
    writeHtmlForRoute(template, routePath, head);
  }
  console.log(`✓ Prerendered ${opponents.length} matchup page(s)`);

  // 3. Blog posts
  try {
    const posts = await fetchPublishedBlogPosts();
    if (Array.isArray(posts) && posts.length > 0) {
      for (const post of posts) {
        if (!post?.slug) continue;
        const routePath = `/blog/${post.slug}`;
        const stripped = stripTemplateSocialTags(template);
        const html = injectBody(stripped.replace('</head>', `${buildBlogHead(post)}\n</head>`), buildBlogBody(post));
        const filePath = path.resolve(distDir, 'blog', post.slug, 'index.html');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, html);
        console.log(`✓ Prerendered ${routePath}`);
      }
      console.log(`✓ Prerendered ${posts.length} blog post page(s)`);
      appendBlogUrlsToSitemap(posts);
    } else {
      console.log('No published blog posts found to prerender.');
    }
  } catch (e) {
    console.warn('Blog prerendering skipped due to error:', e.message);
  }

  // 4. Public database-backed pages
  try {
    console.log(`✓ Prerendered ${await prerenderGameRecaps(template)} game recap page(s)`);
  } catch (e) {
    console.warn('Game recap prerendering skipped due to error:', e.message);
  }
  try {
    console.log(`✓ Prerendered ${await prerenderLiveStreams(template)} live stream page(s)`);
  } catch (e) {
    console.warn('Live stream prerendering skipped due to error:', e.message);
  }

  console.log('\n✓ SSG prerendering complete.');
}

// ---------- Postprocess mode (runs after react-snap) ----------
function routeFilePath(routePath) {
  const rel = routePath === '/' ? '' : routePath.replace(/^\/+|\/+$/g, '');
  return rel ? path.resolve(distDir, rel, 'index.html') : path.resolve(distDir, 'index.html');
}

async function postprocessAll() {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing build template at ${templatePath}. Run the client build first.`);
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  const jobs = [];
  for (const route of STATIC_ROUTES) {
    jobs.push({
      routePath: route.path,
      head: buildHead({
        title: route.title,
        description: route.description,
        keywords: route.keywords,
        canonical: `${SITE_URL}${route.path === '/' ? '/' : route.path}`,
        image: route.image,
      }),
    });
  }

  const opponents = await loadOpponentRegistry();
  for (const opp of opponents) {
    const routePath = `/matchup/${opp.slug}`;
    jobs.push({
      routePath,
      head: buildHead({
        title: `Mets vs ${opp.name} — 2026 Matchup Analysis | MetsXMFanZone`,
        description: `Full breakdown of the New York Mets vs ${opp.name} matchup: lineups, pitching, betting lines, and head-to-head history for the 2026 season.`,
        keywords: `Mets vs ${opp.name}, ${opp.name} matchup, Mets betting, Mets 2026 matchup`,
        canonical: `${SITE_URL}${routePath}`,
      }),
    });
  }

  let posts = [];
  try {
    posts = await fetchPublishedBlogPosts();
    for (const post of posts) {
      if (!post?.slug) continue;
      jobs.push({ routePath: `/blog/${post.slug}`, head: buildBlogHead(post), body: buildBlogBody(post) });
    }
  } catch (e) {
    console.warn('Blog postprocessing skipped due to error:', e.message);
  }

  try {
    const query = new URLSearchParams({ status: 'eq.published', select: 'slug,title,summary,body,hero_image_url,published_at' });
    const recaps = await fetchPublicRows('game_recaps', query.toString());
    for (const recap of recaps) {
      const slug = String(recap.slug || '').trim();
      if (!slug || /\s/.test(slug)) continue;
      const canonical = `${SITE_URL}/mets-game-recaps/${encodeURIComponent(slug)}`;
      const description = String(recap.summary || stripHtml(recap.body || '') || recap.title).slice(0, 160);
      jobs.push({
        routePath: `/mets-game-recaps/${slug}`,
        head: buildHead({
          title: `${recap.title} | Mets Game Recap`, description, canonical,
          image: resolveImage(recap.hero_image_url || '/share/mets-game-recaps.jpg'), type: 'article',
          extraJsonLd: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: recap.title, description, image: [resolveImage(recap.hero_image_url || '/share/mets-game-recaps.jpg')], datePublished: recap.published_at, mainEntityOfPage: canonical },
        }),
      });
    }
  } catch (e) {
    console.warn('Game recap postprocessing skipped due to error:', e.message);
  }

  try {
    const streams = await fetchPublicRows('live_streams_public', 'select=id,title,description,thumbnail_url');
    for (const stream of streams) {
      if (!stream.id) continue;
      const canonical = `${SITE_URL}/live/${stream.id}`;
      const title = `${stream.title} — Live Stream | MetsXMFanZone`;
      const description = String(stream.description || `Watch ${stream.title} live on MetsXMFanZone`).slice(0, 160);
      jobs.push({
        routePath: `/live/${stream.id}`,
        head: buildHead({
          title, description, canonical,
          image: resolveImage(stream.thumbnail_url || '/share/metsxmfanzone.jpg'), type: 'video.other',
        }),
      });
    }
  } catch (e) {
    console.warn('Live stream postprocessing skipped due to error:', e.message);
  }

  let updated = 0;
  let created = 0;
  for (const job of jobs) {
    const filePath = routeFilePath(job.routePath);
    if (fs.existsSync(filePath)) {
      const html = fs.readFileSync(filePath, 'utf-8');
      const withHead = stripTemplateSocialTags(html).replace('</head>', `${job.head}\n</head>`);
      // Only inject article markup when the page does not already contain the
      // real rendered article (otherwise it is template/homepage leftover).
      const alreadyRendered =
        job.bodyMatch && html.includes('<h1') && html.includes(escapeHtml(job.bodyMatch));
      fs.writeFileSync(filePath, alreadyRendered ? withHead : injectBody(withHead, job.body));
      updated++;
    } else {
      writeHtmlForRoute(template, job.routePath, job.head, job.body);
      created++;
    }
  }
  console.log(`✓ Postprocessed ${updated} react-snap page(s), created ${created} fallback page(s)`);

  // Sweep remaining rendered HTML for storage URLs from the retired backend.
  let swept = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) {
        const html = fs.readFileSync(full, 'utf-8');
        if (html.includes('clwghkbtkofacsjeyrtk.supabase.co')) {
          fs.writeFileSync(full, html.replaceAll('clwghkbtkofacsjeyrtk.supabase.co', 'rdmrxeplasttewtlfetc.supabase.co'));
          swept++;
        }
      }
    }
  };
  walk(distDir);
  if (swept) console.log(`✓ Rewrote old storage domain in ${swept} page(s)`);

  if (Array.isArray(posts) && posts.length > 0) {
    appendBlogUrlsToSitemap(posts);
  }
}

if (process.argv.includes('--postprocess')) {
  postprocessAll().catch((error) => {
    console.error('Postprocessing failed:', error);
    process.exit(1);
  });
} else {
  prerenderAll().catch((error) => {
    console.error('Prerendering failed:', error);
    process.exit(1);
  });
}
