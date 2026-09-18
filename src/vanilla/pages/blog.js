import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml, safeUrl, sanitizeArticleHtml } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(value))
  : "";

const summary = (post) => post.excerpt || String(post.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);

const postCard = (post, featured = false) => `
  <article class="story-card ${featured ? "featured" : ""}">
    <a href="/blog/${encodeURIComponent(post.slug.trim())}" aria-label="Read ${escapeHtml(post.title)}">
      <img src="${safeUrl(post.featured_image_url || "/share/blog.jpg", "/share/blog.jpg")}" alt="${escapeHtml(post.title)}" loading="lazy">
      <div class="story-copy">
        <span class="eyebrow">${escapeHtml(post.category || "Mets News")}</span>
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(summary(post))}</p>
        <time datetime="${escapeHtml(post.published_at || "")}">${escapeHtml(formatDate(post.published_at))}</time>
      </div>
    </a>
  </article>`;

export const renderBlog = async (root) => {
  setPageMetadata({
    title: "Mets News, Analysis & Trade Rumors | MetsXMFanZone",
    description: "Read the latest New York Mets news, analysis, trade rumors, game recaps, and original fan coverage.",
    path: "/blog",
    image: "/share/blog.jpg",
  });

  root.innerHTML = renderShell({ content: statusPanel("Mets News", "Loading the latest stories…"), currentPath: "/blog" });
  bindShell(root);

  const { data, error } = await backend
    .from("blog_posts")
    .select("id,title,slug,content,excerpt,featured_image_url,category,tags,published_at")
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error) {
    root.innerHTML = renderShell({ content: statusPanel("Mets News", "Stories are temporarily unavailable.", { href: "/blog", label: "Try again" }), currentPath: "/blog" });
    bindShell(root);
    return;
  }

  const posts = data || [];
  const content = `
    <section class="page-heading content-width">
      <p class="eyebrow">From Queens to every Mets fan</p>
      <h1>Mets News</h1>
      <p>Original reporting, game reactions, roster moves, and fan perspective.</p>
      <label class="search-field"><span>Search articles</span><input id="blog-search" type="search" placeholder="Search Mets news…"></label>
    </section>
    <section class="content-width article-grid" id="article-grid">
      ${posts.map((post, index) => postCard(post, index === 0)).join("") || `<p class="empty-message">No published stories yet.</p>`}
    </section>`;
  root.innerHTML = renderShell({ content, currentPath: "/blog" });
  bindShell(root);

  const search = root.querySelector("#blog-search");
  search?.addEventListener("input", () => {
    const term = search.value.trim().toLowerCase();
    root.querySelector("#article-grid").innerHTML = posts
      .filter((post) => `${post.title} ${post.category} ${summary(post)} ${(post.tags || []).join(" ")}`.toLowerCase().includes(term))
      .map((post, index) => postCard(post, index === 0))
      .join("") || `<p class="empty-message">No stories match that search.</p>`;
  });
};

export const renderBlogPost = async (root, slug) => {
  root.innerHTML = renderShell({ content: statusPanel("MetsXMFanZone", "Loading article…") });
  bindShell(root);

  const { data: post, error } = await backend
    .from("blog_posts")
    .select("id,title,slug,content,excerpt,featured_image_url,audio_url,category,tags,published_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error || !post) {
    root.innerHTML = renderShell({ content: statusPanel("Article unavailable", "This story could not be found.", { href: "/blog", label: "Back to News" }) });
    bindShell(root);
    return;
  }

  const description = summary(post);
  setPageMetadata({
    title: `${post.title} | MetsXMFanZone`,
    description,
    path: `/blog/${encodeURIComponent(post.slug.trim())}`,
    image: post.featured_image_url || "/share/blog.jpg",
    type: "article",
  });

  const shareUrl = encodeURIComponent(window.location.href.split(/[?#]/)[0]);
  const content = `
    <article class="article content-width">
      <a class="back-link" href="/blog">← Back to News</a>
      <img class="article-image" src="${safeUrl(post.featured_image_url || "/share/blog.jpg", "/share/blog.jpg")}" alt="${escapeHtml(post.title)}">
      <header>
        <span class="eyebrow">${escapeHtml(post.category || "Mets News")}</span>
        <h1>${escapeHtml(post.title)}</h1>
        <time datetime="${escapeHtml(post.published_at || "")}">${escapeHtml(formatDate(post.published_at))}</time>
      </header>
      <div class="article-actions">
        <button class="button secondary" id="listen-button" type="button">Listen</button>
        <a class="button secondary" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}">Share</a>
      </div>
      <div class="article-body">${sanitizeArticleHtml(post.content)}</div>
    </article>`;

  root.innerHTML = renderShell({ content, currentPath: "/blog" });
  bindShell(root);
  root.querySelector("#listen-button")?.addEventListener("click", (event) => {
    if (!("speechSynthesis" in window)) return;
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      event.currentTarget.textContent = "Listen";
      return;
    }
    const speech = new SpeechSynthesisUtterance(`${post.title}. ${root.querySelector(".article-body")?.textContent || ""}`.slice(0, 5000));
    speech.onend = () => { event.currentTarget.textContent = "Listen"; };
    event.currentTarget.textContent = "Stop";
    speechSynthesis.speak(speech);
  });
};