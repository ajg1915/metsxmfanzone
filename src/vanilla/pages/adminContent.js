import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { adminPage, requireAdmin, shortDate } from "./admin.js";
import { renderAdminCollection } from "./adminExtra.js";
import { uploadToR2 } from "../core/r2.js";

/* ---------------- Newsletter ---------------- */

export const renderAdminNewsletter = async (root) => {
  const path = "/admin/newsletter";
  setPageMetadata({ title: "Admin · Newsletter | MetsXMFanZone", description: "Generate and send newsletters.", path });
  const state = await requireAdmin(root, path);
  if (!state) return;

  const { count } = await backend.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true);

  adminPage(
    root,
    path,
    "Newsletter",
    `<div class="newsletter-admin">
      <div class="stat-card"><strong>${count || 0}</strong><span>Active subscribers</span></div>
      
      <form class="stacked-form admin-create" id="newsletter-form">
        <label>Newsletter Topic<input name="topic" type="text" placeholder="e.g. Spring Training Updates" required></label>
        <label>Tone
          <select name="tone">
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="enthusiastic">Enthusiastic</option>
            <option value="hype">Hype</option>
          </select>
        </label>
        <button class="button secondary" type="button" id="btn-generate">Generate with AI</button>
        
        <div id="newsletter-edit-area" hidden>
          <label>Email Subject<input name="subject" type="text" required></label>
          <label>Content (HTML)<textarea name="content" rows="12"></textarea></label>
          <div class="admin-create-actions">
            <button class="button primary" type="submit">Send to all subscribers</button>
          </div>
        </div>
      </form>
      <div id="newsletter-status" class="admin-sub" style="margin-top: 1rem;"></div>
    </div>`
  );

  const form = root.querySelector("#newsletter-form");
  const editArea = root.querySelector("#newsletter-edit-area");
  const btnGenerate = root.querySelector("#btn-generate");
  const status = root.querySelector("#newsletter-status");

  btnGenerate.addEventListener("click", async () => {
    const topic = form.elements.topic.value;
    if (!topic) return alert("Please enter a topic");
    
    btnGenerate.disabled = true;
    btnGenerate.textContent = "Generating...";
    status.textContent = "Asking AI to draft your newsletter...";

    try {
      const { data, error } = await backend.functions.invoke("generate-newsletter", {
        body: { topic, tone: form.elements.tone.value, audience: "Mets fans" }
      });
      if (error) throw error;

      form.elements.subject.value = topic;
      form.elements.content.value = data.content || "";
      editArea.hidden = false;
      status.textContent = "Newsletter drafted! Review and edit below.";
    } catch (err) {
      status.textContent = "Error: " + err.message;
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.textContent = "Generate with AI";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to send this to ALL subscribers?")) return;

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Sending...";
    status.textContent = "Sending newsletter...";

    try {
      const { data, error } = await backend.functions.invoke("send-newsletter", {
        body: { 
          subject: form.elements.subject.value, 
          content: form.elements.content.value 
        }
      });
      if (error) throw error;
      alert(`Successfully sent to ${data.sent} subscribers!`);
      form.reset();
      editArea.hidden = true;
      status.textContent = "Newsletter sent successfully.";
    } catch (err) {
      status.textContent = "Error: " + err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Send to all subscribers";
    }
  });
};

/* ---------------- Media Library ---------------- */

export const renderAdminMediaLibrary = async (root) => {
  const path = "/admin/media-library";
  setPageMetadata({ title: "Admin · Media Library | MetsXMFanZone", description: "Manage uploaded assets.", path });
  const state = await requireAdmin(root, path);
  if (!state) return;

  const load = async () => {
    const { data } = await backend.from("media_library").select("*").order("created_at", { ascending: false }).limit(50);
    return data || [];
  };

  const renderGrid = (items) => `
    <div class="media-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; margin-top: 2rem;">
      ${items.map(item => `
        <div class="media-item" style="border: 1px solid #333; padding: 0.5rem; border-radius: 4px;">
          <img src="${escapeHtml(item.url)}" alt="" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 2px;">
          <div style="font-size: 0.7rem; margin-top: 0.5rem; word-break: break-all;">${escapeHtml(item.file_name)}</div>
          <button class="button secondary" style="width: 100%; margin-top: 0.5rem; padding: 0.2rem; font-size: 0.7rem;" data-action="copy" data-url="${escapeHtml(item.url)}">Copy URL</button>
          <button class="button secondary" style="width: 100%; margin-top: 0.2rem; padding: 0.2rem; font-size: 0.7rem; color: #ff4444;" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      `).join("")}
    </div>`;

  let items = await load();
  adminPage(
    root,
    path,
    "Media Library",
    `<div class="media-library-admin">
      <form class="stacked-form admin-create" id="upload-form">
        <label>Upload New Media<input type="file" name="file" accept="image/*" required></label>
        <div id="upload-progress" hidden style="margin-bottom: 0.5rem;">
          <div style="height: 4px; background: #333; border-radius: 2px; overflow: hidden;">
            <div id="progress-bar" style="height: 100%; width: 0%; background: #ff5910; transition: width 0.2s;"></div>
          </div>
        </div>
        <button class="button primary" type="submit">Upload to R2</button>
      </form>
      <div id="media-content">${renderGrid(items)}</div>
    </div>`
  );

  const form = root.querySelector("#upload-form");
  const mediaContent = root.querySelector("#media-content");
  const progress = root.querySelector("#upload-progress");
  const progressBar = root.querySelector("#progress-bar");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = form.elements.file.files[0];
    if (!file) return;

    form.querySelector("button").disabled = true;
    progress.hidden = false;
    progressBar.style.width = "0%";

    try {
      const { publicUrl } = await uploadToR2(file, "media-library", file.name, (p) => {
        progressBar.style.width = p + "%";
      });

      await backend.from("media_library").insert({
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        url: publicUrl,
        storage_path: "r2/" + file.name
      });

      items = await load();
      mediaContent.innerHTML = renderGrid(items);
      form.reset();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      form.querySelector("button").disabled = false;
      progress.hidden = true;
    }
  });

  mediaContent.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    
    if (btn.dataset.action === "copy") {
      navigator.clipboard.writeText(btn.dataset.url);
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy URL", 2000);
    } else if (btn.dataset.action === "delete") {
      if (!confirm("Delete this media?")) return;
      await backend.from("media_library").delete().eq("id", btn.dataset.id);
      items = await load();
      mediaContent.innerHTML = renderGrid(items);
    }
  });
};

/* ---------------- Polls ---------------- */

export const renderAdminPolls = async (root) => {
  const path = "/admin/polls";
  setPageMetadata({ title: "Admin · Polls | MetsXMFanZone", description: "Manage fan polls.", path });
  const state = await requireAdmin(root, path);
  if (!state) return;

  const load = async () => {
    const { data } = await backend.from("polls").select("*").order("created_at", { ascending: false });
    return data || [];
  };

  const rowsHtml = (polls) => polls.map(p => `
    <tr data-id="${p.id}">
      <td>
        <strong>${escapeHtml(p.question)}</strong>
        <span class="admin-sub">${(p.options || []).join(", ")}</span>
      </td>
      <td><span class="pill ${p.is_active ? 'is-live' : ''}">${p.is_active ? 'Active' : 'Ended'}</span></td>
      <td class="admin-actions">
        <button type="button" data-action="toggle">${p.is_active ? 'Close' : 'Open'}</button>
        <button type="button" data-action="delete">Delete</button>
      </td>
    </tr>`).join("") || '<tr><td colspan="3" class="empty-message">No polls yet.</td></tr>';

  let polls = await load();
  adminPage(
    root,
    path,
    "Polls",
    `<form class="stacked-form admin-create" id="poll-form">
      <label>Question<input name="question" type="text" required></label>
      <label>Options (comma separated)<input name="options" type="text" placeholder="Option 1, Option 2, Option 3" required></label>
      <div class="admin-create-actions">
        <button class="button primary" type="submit">Create Poll</button>
      </div>
    </form>
    <table class="admin-table"><tbody id="poll-rows">${rowsHtml(polls)}</tbody></table>`
  );

  const form = root.querySelector("#poll-form");
  const tbody = root.querySelector("#poll-rows");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const options = form.elements.options.value.split(",").map(o => o.trim()).filter(Boolean);
    if (options.length < 2) return alert("Please provide at least 2 options");

    await backend.from("polls").insert({
      question: form.elements.question.value,
      options,
      is_active: true
    });
    form.reset();
    polls = await load();
    tbody.innerHTML = rowsHtml(polls);
  });

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const poll = polls.find(p => p.id === id);

    if (btn.dataset.action === "delete") {
      if (!confirm("Delete poll?")) return;
      await backend.from("polls").delete().eq("id", id);
    } else {
      await backend.from("polls").update({ is_active: !poll.is_active }).eq("id", id);
    }
    polls = await load();
    tbody.innerHTML = rowsHtml(polls);
  });
};

/* ---------------- Routes Export ---------------- */

export const adminContentRoutes = [
  // Newsletter & Media
  { path: "/admin/newsletter", render: renderAdminNewsletter },
  { path: "/admin/media-library", render: renderAdminMediaLibrary },
  { path: "/admin/polls", render: renderAdminPolls },

  // Simple CRUD via adminExtra collections (matching paths)
  { path: "/admin/stories", render: (root) => renderAdminCollection(root, { 
    path: "/admin/stories", table: "stories", title: "Stories", description: "Homepage stories.", empty: "No stories yet." 
  })},
  { path: "/admin/posts", render: (root) => renderAdminCollection(root, { 
    path: "/admin/posts", table: "posts", title: "Community Posts", description: "Moderate fan posts.", empty: "No posts yet." 
  })},
  { path: "/admin/podcasts", render: (root) => renderAdminCollection(root, { 
    path: "/admin/podcasts", table: "podcasts", title: "Podcasts", description: "Manage podcast episodes.", empty: "No podcasts yet." 
  })},
  { path: "/admin/podcast-live-stream", render: (root) => renderAdminCollection(root, { 
    path: "/admin/podcast-live-stream", table: "podcast_live_stream", title: "Podcast Live Streams", description: "Manage live recordings.", empty: "No live recordings found." 
  })},
  { path: "/admin/podcast-outlines", render: (root) => renderAdminCollection(root, { 
    path: "/admin/podcast-outlines", table: "podcast_outline_templates", title: "Podcast Outlines", description: "Show planning templates.", empty: "No templates yet." 
  })},
  { path: "/admin/game-recaps", render: (root) => renderAdminCollection(root, { 
    path: "/admin/game-recaps", table: "game_recaps", title: "Game Recaps", description: "Post-game summaries.", empty: "No recaps yet." 
  })},
  { path: "/admin/hero", render: (root) => renderAdminCollection(root, { 
    path: "/admin/hero", table: "hero_slides", title: "Hero Slides", description: "Homepage banners.", empty: "No slides yet." 
  })},
  { path: "/admin/video-gallery-management", render: (root) => renderAdminCollection(root, { 
    path: "/admin/video-gallery-management", table: "videos", title: "Video Gallery", description: "Gallery video content.", empty: "No videos yet." 
  })},
  { path: "/admin/sweepstakes", render: (root) => renderAdminCollection(root, { 
    path: "/admin/sweepstakes", table: "sweepstakes_events", title: "Sweepstakes", description: "Fan contests and giveaways.", empty: "No sweepstakes yet." 
  })},
  { path: "/admin/predictions", render: (root) => renderAdminCollection(root, { 
    path: "/admin/predictions", table: "daily_player_predictions", title: "Predictions", description: "Daily fan predictions.", empty: "No predictions yet." 
  })},
  { path: "/admin/player-of-the-month", render: (root) => renderAdminCollection(root, { 
    path: "/admin/player-of-the-month", table: "player_of_the_month", title: "Player of the Month", description: "Monthly fan voting.", empty: "No records yet." 
  })},
  { path: "/admin/loyalty-rewards", render: (root) => renderAdminCollection(root, { 
    path: "/admin/loyalty-rewards", table: "loyalty_rewards", title: "Loyalty Rewards", description: "Fan reward points and items.", empty: "No rewards yet." 
  })},
  { path: "/admin/backgrounds", render: (root) => renderAdminCollection(root, { 
    path: "/admin/backgrounds", table: "background_settings", title: "Backgrounds", description: "Story and page backgrounds.", empty: "No backgrounds yet." 
  })},
  { path: "/admin/social-media", render: (root) => renderAdminCollection(root, { 
    path: "/admin/social-media", table: "social_media_connections", title: "Social Media", description: "Platform link settings.", empty: "No connections yet." 
  })},
];
