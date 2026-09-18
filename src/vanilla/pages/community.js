import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml, safeUrl } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";

const relative = (value) => {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
};

const postCard = (post, authorsById) => {
  const author = authorsById.get(post.user_id);
  return `
  <article class="community-post ${post.is_pinned ? "is-pinned" : ""}">
    <header>
      <img class="avatar" src="${safeUrl(author?.avatar_url || "/placeholder.svg", "/placeholder.svg")}" alt="" width="34" height="34">
      <div>
        <strong>${escapeHtml(author?.full_name || "Mets fan")}</strong>
        <time datetime="${escapeHtml(post.created_at || "")}">${escapeHtml(relative(post.created_at))}</time>
      </div>
      ${post.is_pinned ? '<span class="stream-badge">Featured</span>' : ""}
    </header>
    <p>${escapeHtml(post.content || "")}</p>
    ${post.image_url ? `<img class="post-image" src="${safeUrl(post.image_url)}" alt="" loading="lazy">` : ""}
  </article>`;
};

export const renderCommunity = async (root, pathname = "/community") => {
  setPageMetadata({
    title: "Mets Fan Community | MetsXMFanZone",
    description: "Join the MetsXMFanZone community: game talk, reactions, photos, and Mets fans from everywhere.",
    path: pathname,
    image: "/share/community.jpg",
  });

  root.innerHTML = renderShell({ content: statusPanel("Community", "Loading the fan zone…"), currentPath: pathname });
  bindShell(root);

  const state = await auth.ready();

  const loadFeed = async () => {
    const { data: posts } = await backend
      .from("posts")
      .select("id,user_id,content,image_url,is_pinned,created_at")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    const list = posts || [];
    const ids = [...new Set(list.map((post) => post.user_id).filter(Boolean))];
    const authorsById = new Map();
    if (ids.length) {
      const { data: profiles } = await backend
        .from("profiles")
        .select("id,full_name,avatar_url")
        .in("id", ids);
      (profiles || []).forEach((profile) => authorsById.set(profile.id, profile));
    }
    return list.map((post) => postCard(post, authorsById)).join("") || '<p class="empty-message">No posts yet. Be the first.</p>';
  };

  const feed = await loadFeed();

  const composer = state.user
    ? `<form class="stacked-form composer" id="community-form">
         <label>Share something with the fan zone
           <textarea name="content" rows="3" maxlength="1000" required placeholder="What's your take?"></textarea>
         </label>
         <p class="form-error" id="community-error" hidden role="alert"></p>
         <button class="button primary" type="submit">Post</button>
       </form>`
    : `<p class="form-note">Sign in to join the conversation. <a href="/auth?next=/community">Sign in</a></p>`;

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Fan Zone</p>
      <h1>Community</h1>
      <p>Talk Mets with fans from Queens and everywhere else.</p>
    </section>
    <section class="content-width">${composer}</section>
    <section class="content-width community-feed" id="community-feed">${feed}</section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const form = root.querySelector("#community-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = root.querySelector("#community-error");
    const textarea = form.querySelector("textarea");
    const submit = form.querySelector("button[type=submit]");
    const text = textarea.value.trim();
    if (!text) return;

    submit.disabled = true;
    error.hidden = true;
    const { error: insertError } = await backend
      .from("posts")
      .insert({ user_id: state.user.id, content: text });

    if (insertError) {
      error.textContent = insertError.message || "Your post could not be saved.";
      error.hidden = false;
    } else {
      textarea.value = "";
      root.querySelector("#community-feed").innerHTML = await loadFeed();
    }
    submit.disabled = false;
  });
};
