import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml, safeUrl, sanitizeArticleHtml } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";

const longDate = (value) =>
  value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "";

const duration = (seconds) => {
  const total = Number(seconds || 0);
  if (!total) return "";
  const minutes = Math.floor(total / 60);
  const rest = String(Math.floor(total % 60)).padStart(2, "0");
  return `${minutes}:${rest}`;
};

/* ---------------- Podcast ---------------- */

export const renderPodcast = async (root, pathname = "/podcast") => {
  setPageMetadata({
    title: "MetsXMFanZone Podcast | Mets Talk, Reactions & Interviews",
    description: "Listen to the MetsXMFanZone podcast: game reactions, roster talk, interviews, and fan conversations.",
    path: pathname,
    image: "/share/podcast.jpg",
  });

  root.innerHTML = renderShell({ content: statusPanel("Podcast", "Loading episodes…"), currentPath: pathname });
  bindShell(root);

  const { data } = await backend
    .from("podcasts")
    .select("id,title,description,audio_url,duration,published_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(40);

  const episodes = data || [];
  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">MetsXMFanZone Podcast</p>
      <h1>Straight From The Fan Zone</h1>
      <p>Game reactions, roster talk, interviews, and the Mets conversations fans care about.</p>
    </section>
    <section class="content-width episode-list">
      ${
        episodes
          .map(
            (episode) => `
        <article class="episode-card">
          <h2>${escapeHtml(episode.title || "Episode")}</h2>
          <p class="stream-meta">${escapeHtml(longDate(episode.published_at))}${episode.duration ? ` · ${escapeHtml(duration(episode.duration))}` : ""}</p>
          ${episode.description ? `<p>${escapeHtml(episode.description)}</p>` : ""}
          <audio controls preload="none" src="${safeUrl(episode.audio_url || "", "")}"></audio>
        </article>`,
          )
          .join("") || '<p class="empty-message">No episodes published yet.</p>'
      }
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

/* ---------------- Video gallery ---------------- */

export const renderVideoGallery = async (root, pathname = "/video-gallery") => {
  setPageMetadata({
    title: "Mets Video Gallery | Highlights & Replays | MetsXMFanZone",
    description: "Watch New York Mets highlights, replays, and original MetsXMFanZone video coverage.",
    path: pathname,
    image: "/share/videos.jpg",
  });

  root.innerHTML = renderShell({ content: statusPanel("Videos", "Loading videos…"), currentPath: pathname });
  bindShell(root);

  const { data } = await backend
    .from("videos")
    .select("id,title,description,video_url,thumbnail_url,category,duration,published_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(48);

  const videos = data || [];
  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Video</p>
      <h1>Highlights &amp; Replays</h1>
    </section>
    <section class="content-width video-grid">
      ${
        videos
          .map(
            (video) => `
        <article class="video-card">
          <button type="button" data-video="${safeUrl(video.video_url || "", "")}" data-title="${escapeHtml(video.title || "")}">
            <img src="${safeUrl(video.thumbnail_url || "/share/videos.jpg", "/share/videos.jpg")}" alt="${escapeHtml(video.title || "Video")}" loading="lazy">
            <span class="stream-badge">${escapeHtml(duration(video.duration) || "Play")}</span>
            <h2>${escapeHtml(video.title || "Video")}</h2>
          </button>
        </article>`,
          )
          .join("") || '<p class="empty-message">No videos published yet.</p>'
      }
    </section>
    <dialog class="video-dialog" id="video-dialog">
      <video controls playsinline id="gallery-player"></video>
      <button class="button secondary" type="button" id="close-video">Close</button>
    </dialog>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const dialog = root.querySelector("#video-dialog");
  const player = root.querySelector("#gallery-player");
  root.querySelectorAll("[data-video]").forEach((button) => {
    button.addEventListener("click", () => {
      player.src = button.dataset.video;
      dialog.showModal();
      player.play().catch(() => {});
    });
  });
  const close = () => {
    player.pause();
    player.removeAttribute("src");
    player.load();
    dialog.close();
  };
  root.querySelector("#close-video")?.addEventListener("click", close);
  dialog?.addEventListener("close", () => {
    player.pause();
  });
};

/* ---------------- Game recaps ---------------- */

const recapCard = (recap) => `
  <article class="story-card">
    <a href="/mets-game-recaps/${encodeURIComponent(recap.slug || recap.id)}">
      <img src="${safeUrl(recap.hero_image_url || "/share/recaps.jpg", "/share/recaps.jpg")}" alt="${escapeHtml(recap.title || "Game recap")}" loading="lazy">
      <div class="story-copy">
        <span class="eyebrow">${escapeHtml(recap.result || "Recap")} · ${escapeHtml(recap.opponent || "")}</span>
        <h2>${escapeHtml(recap.title || "Mets game recap")}</h2>
        <p>${escapeHtml(recap.summary || "")}</p>
        <time datetime="${escapeHtml(recap.game_date || "")}">${escapeHtml(longDate(recap.game_date))}</time>
      </div>
    </a>
  </article>`;

export const renderRecaps = async (root, pathname = "/mets-game-recaps") => {
  setPageMetadata({
    title: "Mets Game Recaps | MetsXMFanZone",
    description: "Read New York Mets game recaps with scores, highlights, and analysis after every game.",
    path: pathname,
    image: "/share/recaps.jpg",
  });

  root.innerHTML = renderShell({ content: statusPanel("Game Recaps", "Loading recaps…"), currentPath: pathname });
  bindShell(root);

  const { data } = await backend
    .from("game_recaps")
    .select("id,title,slug,opponent,game_date,result,mets_score,opponent_score,summary,hero_image_url,status")
    .eq("status", "published")
    .order("game_date", { ascending: false })
    .limit(40);

  const recaps = data || [];
  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Every game, every night</p>
      <h1>Mets Game Recaps</h1>
    </section>
    <section class="content-width article-grid">
      ${recaps.map(recapCard).join("") || '<p class="empty-message">No recaps published yet.</p>'}
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

export const renderRecap = async (root, slug) => {
  const pathname = `/mets-game-recaps/${slug}`;
  root.innerHTML = renderShell({ content: statusPanel("Game Recap", "Loading recap…"), currentPath: pathname });
  bindShell(root);

  const { data: recap } = await backend
    .from("game_recaps")
    .select("id,title,slug,opponent,game_date,result,mets_score,opponent_score,summary,body,hero_image_url,status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!recap) {
    root.innerHTML = renderShell({
      content: statusPanel("Game Recap", "This recap is not available.", { href: "/mets-game-recaps", label: "All recaps" }),
      currentPath: pathname,
    });
    bindShell(root);
    return;
  }

  setPageMetadata({
    title: `${recap.title} | MetsXMFanZone`,
    description: recap.summary || "New York Mets game recap from MetsXMFanZone.",
    path: pathname,
    image: recap.hero_image_url || "/share/recaps.jpg",
    type: "article",
  });

  const content = `
    <article class="content-width article-body">
      <p class="eyebrow">${escapeHtml(recap.result || "Recap")} · ${escapeHtml(recap.opponent || "")}</p>
      <h1>${escapeHtml(recap.title)}</h1>
      <p class="stream-meta">${escapeHtml(longDate(recap.game_date))} · Mets ${escapeHtml(String(recap.mets_score ?? "-"))} – ${escapeHtml(String(recap.opponent_score ?? "-"))} ${escapeHtml(recap.opponent || "")}</p>
      ${recap.hero_image_url ? `<img src="${safeUrl(recap.hero_image_url)}" alt="${escapeHtml(recap.title)}">` : ""}
      <div class="rich-text">${sanitizeArticleHtml(recap.body || `<p>${escapeHtml(recap.summary || "")}</p>`)}</div>
      <a class="button secondary" href="/mets-game-recaps">All recaps</a>
    </article>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};
