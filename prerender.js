import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, 'dist');
const templatePath = path.resolve(distDir, 'index.html');

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://metsxmfanzone.com';
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://clwghkbtkofacsjeyrtk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsd2doa2J0a29mYWNzamV5cnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTI3NDIsImV4cCI6MjA3NzkyODc0Mn0.11mr9r-U-BAwy9Mmr2yrzjLhjljswgOotJeOOXyfllc';
const FALLBACK_IMAGE = `${SITE_URL}/logo-512.png`;

function escapeHtml(input) {
  return String(input ?? '').replace(/[&<>"']/g, (match) => (
    {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[match] || match
  ));
}

function stripHtml(input) {
  return String(input ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveImage(url) {
  if (!url) return FALLBACK_IMAGE;
  if (url.startsWith('data:')) return FALLBACK_IMAGE;
  if (url.startsWith('http://')) return `https://${url.slice(7)}`;
  if (url.startsWith('https://')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function getDescription(post) {
  const rawDescription =
    (post.excerpt && String(post.excerpt).trim().length > 0
      ? String(post.excerpt)
      : stripHtml(post.content || '')) || String(post.title || '');

  return rawDescription.length > 160
    ? `${rawDescription.slice(0, 157)}...`
    : rawDescription;
}

function getKeywords(post) {
  return [post.category, ...(Array.isArray(post.tags) ? post.tags : [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
}

function stripTemplateSocialTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="title"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="keywords"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="fb:app_id"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^\"]+"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^\"]+"[^>]*>\s*/gi, '');
}

function buildBlogHead(post) {
  const slug = encodeURIComponent(post.slug);
  const postUrl = `${SITE_URL}/blog/${slug}`;
  const socialImage = resolveImage(post.featured_image_url);
  const description = getDescription(post);
  const keywords = getKeywords(post);
  const socialTitle = `${post.title} | MetsXMFanZone`;
  const publishedTime = post.published_at || new Date().toISOString();
  const modifiedTime = post.updated_at || publishedTime;

  const tagsMeta = (Array.isArray(post.tags) ? post.tags : [])
    .map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`)
    .join('\n    ');

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description,
    image: [socialImage],
    datePublished: publishedTime,
    dateModified: modifiedTime,
    author: {
      '@type': 'Organization',
      name: 'MetsXMFanZone',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'MetsXMFanZone',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo-512.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    articleSection: post.category || undefined,
    keywords: keywords || undefined,
  };

  return `
    <title>${escapeHtml(socialTitle)}</title>
    <meta name="title" content="${escapeHtml(socialTitle)}" />
    <meta name="description" content="${escapeHtml(description)}" />
    ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : ''}
    <link rel="canonical" href="${postUrl}" />

    <meta property="fb:app_id" content="1151558476948104" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${postUrl}" />
    <meta property="og:site_name" content="MetsXMFanZone" />
    <meta property="og:title" content="${escapeHtml(socialTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${socialImage}" />
    <meta property="og:image:secure_url" content="${socialImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(post.title)}" />
    <meta property="og:locale" content="en_US" />
    <meta property="article:published_time" content="${escapeHtml(publishedTime)}" />
    <meta property="article:modified_time" content="${escapeHtml(modifiedTime)}" />
    <meta property="article:section" content="${escapeHtml(post.category || '')}" />
    <meta property="article:author" content="MetsXMFanZone" />
    ${tagsMeta}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@metsxmfanzone" />
    <meta name="twitter:creator" content="@metsxmfanzone" />
    <meta name="twitter:domain" content="metsxmfanzone.com" />
    <meta name="twitter:title" content="${escapeHtml(socialTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${socialImage}" />
    <meta name="twitter:image:alt" content="${escapeHtml(post.title)}" />

    <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  `.trim();
}

async function fetchPublishedBlogPosts() {
  const query = new URLSearchParams({
    published: 'eq.true',
    select: 'slug,title,excerpt,content,featured_image_url,category,tags,published_at,updated_at',
    order: 'published_at.desc.nullslast',
  });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?${query.toString()}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch published blog posts [${response.status}]: ${body}`);
  }

  return response.json();
}

function writeBlogPage(baseTemplate, post) {
  const template = stripTemplateSocialTags(baseTemplate);
  const filePath = path.resolve(distDir, 'blog', post.slug, 'index.html');
  const html = template.replace('</head>', `${buildBlogHead(post)}\n</head>`);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
  console.log(`✓ Prerendered /blog/${post.slug}`);
}

async function prerenderBlogPosts() {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing build template at ${templatePath}. Run the client build first.`);
  }

  const template = fs.readFileSync(templatePath, 'utf-8');
  const posts = await fetchPublishedBlogPosts();

  if (!Array.isArray(posts) || posts.length === 0) {
    console.log('No published blog posts found to prerender.');
    return;
  }

  for (const post of posts) {
    if (post?.slug) {
      writeBlogPage(template, post);
    }
  }

  console.log(`\n✓ Prerendered ${posts.length} blog post page(s)`);
}

prerenderBlogPosts().catch((error) => {
  console.error('Blog prerendering failed:', error);
  process.exit(1);
});