import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";

const SECTIONS = [
  ["/admin", "Dashboard"],
  ["/admin/blog", "Articles"],
  ["/admin/stories", "Stories"],
  ["/admin/hero", "Hero slides"],
  ["/admin/streams", "Streams"],
  ["/admin/videos", "Videos"],
  ["/admin/podcasts", "Podcasts"],
  ["/admin/events", "Events"],
  ["/admin/predictions", "Predictions"],
  ["/admin/lineups", "Lineups"],
  ["/admin/media", "Media"],
  ["/admin/popups", "Popups"],
  ["/admin/community", "Community"],
  ["/admin/feedback", "Feedback"],
  ["/admin/support", "Support"],
  ["/admin/users", "Members"],
  ["/admin/subscriptions", "Subscriptions"],
  ["/admin/roles", "Roles"],
];

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const shortDate = (value) =>
  value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "—";

const adminNav = (current) => `
  <nav class="admin-nav" aria-label="Admin sections">
    ${SECTIONS.map(
      ([href, label]) =>
        `<a href="${href}" ${current === href ? 'aria-current="page"' : ""}>${escapeHtml(label)}</a>`,
    ).join("")}
  </nav>`;

export const adminPage = (root, pathname, title, body) => {
  root.innerHTML = renderShell({
    content: `
      <section class="content-width page-heading">
        <p class="eyebrow">Admin</p>
        <h1>${escapeHtml(title)}</h1>
      </section>
      <section class="content-width">${adminNav(pathname)}</section>
      <section class="content-width admin-body">${body}</section>`,
    currentPath: pathname,
  });
  bindShell(root);
};

export const requireAdmin = async (root, pathname) => {
  root.innerHTML = renderShell({ content: statusPanel("Admin", "Checking your access…"), currentPath: pathname });
  bindShell(root);

  const state = await auth.ready();
  if (!state.user) {
    window.location.replace(`/auth?next=${encodeURIComponent(pathname)}`);
    return null;
  }
  if (!state.isAdmin) {
    adminPage(root, pathname, "Admin", '<p class="empty-message">This area is for administrators only.</p>');
    return null;
  }
  return state;
};

/* ---------------- Dashboard ---------------- */

export const renderAdminHome = async (root) => {
  setPageMetadata({ title: "Admin | MetsXMFanZone", description: "MetsXMFanZone administration.", path: "/admin" });
  const state = await requireAdmin(root, "/admin");
  if (!state) return;

  const count = async (table, filters = (query) => query) => {
    const { count: total } = await filters(backend.from(table).select("id", { count: "exact", head: true }));
    return total ?? 0;
  };

  const [articles, drafts, streams, members, messages] = await Promise.all([
    count("blog_posts", (query) => query.eq("published", true)),
    count("blog_posts", (query) => query.eq("published", false)),
    count("live_streams", (query) => query.eq("published", true)),
    count("profiles"),
    count("contact_submissions"),
  ]);

  adminPage(
    root,
    "/admin",
    "Dashboard",
    `<div class="stat-grid">
      ${[
        ["Published articles", articles, "/admin/blog"],
        ["Drafts", drafts, "/admin/blog"],
        ["Published streams", streams, "/admin/streams"],
        ["Members", members, "/admin/users"],
        ["Support messages", messages, "/admin"],
      ]
        .map(
          ([label, value, href]) =>
            `<a class="stat-card" href="${href}"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></a>`,
        )
        .join("")}
    </div>`,
  );
};

/* ---------------- Articles ---------------- */

export const renderAdminBlog = async (root) => {
  setPageMetadata({ title: "Admin · Articles | MetsXMFanZone", description: "Manage articles.", path: "/admin/blog" });
  const state = await requireAdmin(root, "/admin/blog");
  if (!state) return;

  const load = async () => {
    const { data } = await backend
      .from("blog_posts")
      .select("id,title,slug,category,published,published_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    return data || [];
  };

  const rowsHtml = (posts) =>
    posts
      .map(
        (post) => `
      <tr data-id="${escapeHtml(post.id)}">
        <td>
          <strong>${escapeHtml(post.title || "Untitled")}</strong>
          <span class="admin-sub">/blog/${escapeHtml(String(post.slug || "").trim())} · ${escapeHtml(shortDate(post.published_at || post.updated_at))}</span>
        </td>
        <td>${post.published ? '<span class="pill is-live">Published</span>' : '<span class="pill">Draft</span>'}</td>
        <td class="admin-actions">
          <button type="button" data-action="toggle">${post.published ? "Unpublish" : "Publish"}</button>
          <button type="button" data-action="delete">Delete</button>
        </td>
      </tr>`,
      )
      .join("") || '<tr><td colspan="3" class="empty-message">No articles yet.</td></tr>';

  let posts = await load();

  adminPage(
    root,
    "/admin/blog",
    "Articles",
    `<form class="stacked-form admin-create" id="new-post">
       <label>New article title<input name="title" type="text" required></label>
       <label>Category<input name="category" type="text" placeholder="Mets News"></label>
       <label>Article<textarea name="content" rows="6" required></textarea></label>
       <label>Featured image URL<input name="featured_image_url" type="url"></label>
       <p class="form-error" id="admin-error" hidden role="alert"></p>
       <div class="admin-create-actions">
         <button class="button secondary" type="submit" data-publish="false">Save draft</button>
         <button class="button primary" type="submit" data-publish="true">Publish now</button>
       </div>
     </form>
     <table class="admin-table"><tbody id="post-rows">${rowsHtml(posts)}</tbody></table>`,
  );

  const tbody = root.querySelector("#post-rows");
  const error = root.querySelector("#admin-error");
  const form = root.querySelector("#new-post");
  let publishIntent = false;

  form.querySelectorAll("button[type=submit]").forEach((button) => {
    button.addEventListener("click", () => {
      publishIntent = button.dataset.publish === "true";
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    error.hidden = true;

    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const payload = {
      title,
      slug: slugify(title),
      content: String(data.get("content") || "").trim(),
      category: String(data.get("category") || "").trim() || "Mets News",
      featured_image_url: String(data.get("featured_image_url") || "").trim() || null,
      author_id: state.user.id,
      published: publishIntent,
      published_at: publishIntent ? new Date().toISOString() : null,
    };

    const { error: insertError } = await backend.from("blog_posts").insert(payload);
    if (insertError) {
      error.textContent = insertError.message;
      error.hidden = false;
      return;
    }
    form.reset();
    posts = await load();
    tbody.innerHTML = rowsHtml(posts);
  });

  tbody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("tr");
    const id = row.dataset.id;
    const post = posts.find((item) => item.id === id);
    button.disabled = true;

    if (button.dataset.action === "delete") {
      if (!window.confirm("Delete this article permanently?")) {
        button.disabled = false;
        return;
      }
      await backend.from("blog_posts").delete().eq("id", id);
    } else {
      const next = !post.published;
      await backend
        .from("blog_posts")
        .update({ published: next, published_at: next ? post.published_at || new Date().toISOString() : null })
        .eq("id", id);
    }

    posts = await load();
    tbody.innerHTML = rowsHtml(posts);
  });
};

/* ---------------- Streams ---------------- */

export const renderAdminStreams = async (root) => {
  setPageMetadata({ title: "Admin · Streams | MetsXMFanZone", description: "Manage streams.", path: "/admin/streams" });
  const state = await requireAdmin(root, "/admin/streams");
  if (!state) return;

  const load = async () => {
    const { data } = await backend
      .from("live_streams")
      .select("id,title,status,published,scheduled_start,assigned_pages")
      .order("scheduled_start", { ascending: false })
      .limit(60);
    return data || [];
  };

  const rowsHtml = (streams) =>
    streams
      .map(
        (stream) => `
      <tr data-id="${escapeHtml(stream.id)}">
        <td>
          <strong>${escapeHtml(stream.title || "Untitled stream")}</strong>
          <span class="admin-sub">${escapeHtml(shortDate(stream.scheduled_start))} · ${escapeHtml((stream.assigned_pages || []).join(", ") || "unassigned")}</span>
        </td>
        <td><span class="pill ${stream.status === "live" ? "is-live" : ""}">${escapeHtml(stream.status || "scheduled")}</span></td>
        <td class="admin-actions">
          <button type="button" data-action="live">${stream.status === "live" ? "End" : "Go live"}</button>
          <button type="button" data-action="publish">${stream.published ? "Hide" : "Show"}</button>
        </td>
      </tr>`,
      )
      .join("") || '<tr><td colspan="3" class="empty-message">No streams yet.</td></tr>';

  let streams = await load();
  adminPage(root, "/admin/streams", "Streams", `<table class="admin-table"><tbody id="stream-rows">${rowsHtml(streams)}</tbody></table>`);

  const tbody = root.querySelector("#stream-rows");
  tbody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.closest("tr").dataset.id;
    const stream = streams.find((item) => item.id === id);
    button.disabled = true;

    if (button.dataset.action === "live") {
      const goingLive = stream.status !== "live";
      await backend
        .from("live_streams")
        .update({
          status: goingLive ? "live" : "ended",
          actual_start: goingLive ? new Date().toISOString() : undefined,
          actual_end: goingLive ? undefined : new Date().toISOString(),
        })
        .eq("id", id);
    } else {
      await backend.from("live_streams").update({ published: !stream.published }).eq("id", id);
    }

    streams = await load();
    tbody.innerHTML = rowsHtml(streams);
  });
};

/* ---------------- Community moderation ---------------- */

export const renderAdminCommunity = async (root) => {
  setPageMetadata({ title: "Admin · Community | MetsXMFanZone", description: "Moderate community posts.", path: "/admin/community" });
  const state = await requireAdmin(root, "/admin/community");
  if (!state) return;

  const load = async () => {
    const { data } = await backend
      .from("posts")
      .select("id,content,is_pinned,created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    return data || [];
  };

  const rowsHtml = (posts) =>
    posts
      .map(
        (post) => `
      <tr data-id="${escapeHtml(post.id)}">
        <td><strong>${escapeHtml(String(post.content || "").slice(0, 120))}</strong><span class="admin-sub">${escapeHtml(shortDate(post.created_at))}</span></td>
        <td>${post.is_pinned ? '<span class="pill is-live">Featured</span>' : ""}</td>
        <td class="admin-actions">
          <button type="button" data-action="pin">${post.is_pinned ? "Unfeature" : "Feature"}</button>
          <button type="button" data-action="delete">Delete</button>
        </td>
      </tr>`,
      )
      .join("") || '<tr><td colspan="3" class="empty-message">No community posts.</td></tr>';

  let posts = await load();
  adminPage(root, "/admin/community", "Community", `<table class="admin-table"><tbody id="community-rows">${rowsHtml(posts)}</tbody></table>`);

  const tbody = root.querySelector("#community-rows");
  tbody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.closest("tr").dataset.id;
    const post = posts.find((item) => item.id === id);
    button.disabled = true;

    if (button.dataset.action === "delete") {
      if (!window.confirm("Delete this post?")) {
        button.disabled = false;
        return;
      }
      await backend.from("posts").delete().eq("id", id);
    } else {
      await backend
        .from("posts")
        .update({ is_pinned: !post.is_pinned, pinned_at: post.is_pinned ? null : new Date().toISOString() })
        .eq("id", id);
    }

    posts = await load();
    tbody.innerHTML = rowsHtml(posts);
  });
};

/* ---------------- Members ---------------- */

export const renderAdminUsers = async (root) => {
  setPageMetadata({ title: "Admin · Members | MetsXMFanZone", description: "Member directory.", path: "/admin/users" });
  const state = await requireAdmin(root, "/admin/users");
  if (!state) return;

  const { data } = await backend
    .from("profiles")
    .select("id,full_name,subscription_tier,subscription_status,subscription_end_date,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const members = data || [];
  adminPage(
    root,
    "/admin/users",
    "Members",
    `<table class="admin-table"><tbody>
      ${
        members
          .map(
            (member) => `
        <tr>
          <td><strong>${escapeHtml(member.full_name || "Member")}</strong><span class="admin-sub">Joined ${escapeHtml(shortDate(member.created_at))}</span></td>
          <td><span class="pill ${member.subscription_status === "active" ? "is-live" : ""}">${escapeHtml(member.subscription_tier || "none")}</span></td>
          <td>${escapeHtml(shortDate(member.subscription_end_date))}</td>
        </tr>`,
          )
          .join("") || '<tr><td class="empty-message">No members found.</td></tr>'
      }
    </tbody></table>`,
  );
};
