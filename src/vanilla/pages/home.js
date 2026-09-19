import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml, safeUrl } from "../core/sanitize.js";
import { bindShell, renderShell } from "../ui/shell.js";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value))
    : "";

const formatStart = (value) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      }).format(new Date(value)) + " ET"
    : "Scheduled";

const heroSlide = (slide) => `
  <li class="hero-slide" style="--slide-image: url('${safeUrl(slide.image_url || "/og-image.png", "/og-image.png")}')">
    <div class="hero-slide-copy">
      <h2>${escapeHtml(slide.title || "MetsXMFanZone")}</h2>
      ${slide.description ? `<p>${escapeHtml(slide.description)}</p>` : ""}
      ${
        slide.link_url
          ? `<a class="button primary" href="${safeUrl(slide.link_url, "/")}">${escapeHtml(slide.link_text || "Open")}</a>`
          : ""
      }
    </div>
  </li>`;

const streamCard = (stream) => {
  const live = stream.status === "live";
  return `
  <article class="stream-card">
    <a href="/live/${encodeURIComponent(stream.id)}">
      <img src="${safeUrl(stream.thumbnail_url || "/share/metsxmfanzone.jpg", "/share/metsxmfanzone.jpg")}" alt="${escapeHtml(stream.title || "Live stream")}" loading="lazy">
      <span class="stream-badge ${live ? "is-live" : ""}">${live ? "LIVE" : formatStart(stream.scheduled_start)}</span>
      <h3>${escapeHtml(stream.title || "MetsXMFanZone Live")}</h3>
    </a>
  </article>`;
};

const storyCard = (post) => `
  <article class="story-card">
    <a href="/blog/${encodeURIComponent(String(post.slug || "").trim())}">
      <img src="${safeUrl(post.featured_image_url || "/share/blog.jpg", "/share/blog.jpg")}" alt="${escapeHtml(post.title)}" loading="lazy">
      <div class="story-copy">
        <span class="eyebrow">${escapeHtml(post.category || "Mets News")}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <time datetime="${escapeHtml(post.published_at || "")}">${escapeHtml(formatDate(post.published_at))}</time>
      </div>
    </a>
  </article>`;

const loadHomeData = async () => {
  const [slides, streams, posts] = await Promise.all([
    backend
      .from("hero_slides")
      .select("id,title,description,image_url,link_url,link_text,display_order")
      .eq("published", true)
      .order("display_order", { ascending: true })
      .limit(6),
    backend
      .from("live_streams")
      .select("id,title,thumbnail_url,status,scheduled_start")
      .eq("published", true)
      .in("status", ["live", "scheduled"])
      .order("scheduled_start", { ascending: true })
      .limit(8),
    backend
      .from("blog_posts")
      .select("id,title,slug,featured_image_url,category,published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(6),
  ]);

  return {
    slides: slides.data || [],
    streams: streams.data || [],
    posts: posts.data || [],
  };
};

export const renderHome = async (root) => {
  setPageMetadata({
    title: "MetsXMFanZone — New York Mets Fan Community",
    description:
      "Live games, podcasts, original Mets news, highlights, and a passionate New York Mets fan community.",
    path: "/",
    image: "/share/home.jpg",
  });

  const intro = `
    <section class="home-intro content-width">
      <p class="eyebrow">The Ultimate Destination Where The Fans Go</p>
      <h1>New York Mets. Every Game. Every Story.</h1>
      <div class="hero-actions">
        <a class="button primary" href="/metsxmfanzone">Watch Live</a>
        <a class="button secondary" href="/blog">Latest News</a>
      </div>
    </section>`;

  root.innerHTML = renderShell({
    content: `${intro}<section class="content-width"><p class="empty-message">Loading today's coverage…</p></section>`,
    currentPath: "/",
  });
  bindShell(root);

  const { slides, streams, posts } = await loadHomeData();

  const content = `
    ${intro}
    ${
      slides.length
        ? `<section class="content-width home-section">
            <h2 class="section-title">Featured</h2>
            <ul class="hero-rail">${slides.map(heroSlide).join("")}</ul>
          </section>`
        : ""
    }
    ${
      streams.length
        ? `<section class="content-width home-section">
            <h2 class="section-title">Live &amp; Upcoming</h2>
            <div class="stream-rail">${streams.map(streamCard).join("")}</div>
          </section>`
        : ""
    }
    <section class="content-width home-section">
      <h2 class="section-title">Latest Mets News</h2>
      <div class="article-grid">
        ${posts.map(storyCard).join("") || '<p class="empty-message">No published stories yet.</p>'}
      </div>
      <a class="button secondary" href="/blog">See all news</a>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: "/" });
  bindShell(root);
};
