# Per-page social sharing previews

## Goal
Give every public page a consistent MetsXMFanZone link preview with its own title, description, canonical URL, and branded 1200×630 image. Blog posts will use their featured image when available, with a branded fallback.

## Implementation
1. **Create a share-preview registry**
   - Define one canonical `metsxmfanzone.com` URL and page-specific metadata for every public route.
   - Group related pages into branded image themes such as News, Live, Game Center, Community, Podcast, Shop, Help, and Legal.
   - Exclude private account, payment, admin, writer, and authentication screens from public sharing and mark those pages as non-indexable where appropriate.

2. **Create the branded image set**
   - Produce optimized 1200×630 JPEG cards using the approved MetsXMFanZone artwork, logo, blue/orange identity, and readable page labels.
   - Keep each file small enough for Facebook, X, LinkedIn, iMessage, and WhatsApp previews.
   - Provide a branded fallback for articles or dynamic pages that do not have a usable image.

3. **Unify browser metadata**
   - Update the shared SEO helper so canonical URLs consistently use the non-`www` domain.
   - Add complete Open Graph and Twitter fields, including image type, size, alt text, title, and description.
   - Update public pages that currently use inconsistent or missing metadata to use the shared page registry.

4. **Make crawler-visible metadata route-specific**
   - Extend the existing pre-render step so every public route is emitted with its own title, description, canonical, Open Graph image, and Twitter image in the initial HTML.
   - Keep blog posts dynamic at build time: each published article receives its own title, summary, canonical URL, and featured image.
   - Add crawler-visible metadata for dynamic public recaps, streams, players, and matchup pages where build-time data is available; use the correct branded category fallback otherwise.

5. **Sitemap and verification**
   - Align sitemap entries with canonical URLs and include every indexable public route and clean blog slug.
   - Verify representative static pages and articles in generated HTML, including image dimensions, absolute HTTPS image URLs, titles, descriptions, and self-referencing canonicals.
   - Confirm browser navigation still updates metadata correctly and that no private pages are added to the sitemap.

## Technical notes
- Social crawlers generally do not execute React, so the pre-rendered HTML remains the source of truth for previews.
- Blog posts retain their own featured artwork; images are not replaced unless missing or unusable.
- The published site must be redeployed before social platforms can read these changes. Platforms may temporarily show cached previews until they re-scrape the URL.
