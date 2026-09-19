import { backend } from "../core/backend.js";
import { escapeHtml } from "../core/sanitize.js";
import { adminPage, requireAdmin, shortDate } from "./admin.js";
import { setPageMetadata } from "../core/metadata.js";

/**
 * Generic admin collection screen.
 * Renders any backend table as a plain HTML table with publish/active
 * toggles and delete, without any framework code.
 */

const pick = (row, keys, fallback = "") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return fallback;
};

const TITLE_KEYS = ["title", "name", "headline", "full_name", "subject", "question", "message", "content"];
const DATE_KEYS = ["created_at", "updated_at", "published_at", "start_date", "event_date", "scheduled_start"];
const FLAG_KEYS = ["published", "is_active", "active", "is_published", "is_visible", "enabled"];

const rowsHtml = (rows, config) => {
  if (!rows.length) return `<tr><td colspan="3" class="empty-message">${escapeHtml(config.empty)}</td></tr>`;
  return rows
    .map((row) => {
      const flagKey = FLAG_KEYS.find((key) => typeof row[key] === "boolean");
      const on = flagKey ? row[flagKey] : null;
      const title = String(pick(row, config.titleKeys || TITLE_KEYS, "Untitled")).slice(0, 140);
      const meta = [shortDate(pick(row, DATE_KEYS, null)), pick(row, config.metaKeys || [], "")]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr data-id="${escapeHtml(String(row.id))}">
          <td><strong>${escapeHtml(title)}</strong><span class="admin-sub">${escapeHtml(meta)}</span></td>
          <td>${
            flagKey
              ? `<span class="pill ${on ? "is-live" : ""}">${on ? "Live" : "Hidden"}</span>`
              : `<span class="pill">${escapeHtml(String(pick(row, config.statusKeys || ["status"], "—")))}</span>`
          }</td>
          <td class="admin-actions">
            ${flagKey ? `<button type="button" data-action="toggle" data-flag="${flagKey}">${on ? "Hide" : "Show"}</button>` : ""}
            <button type="button" data-action="delete">Delete</button>
          </td>
        </tr>`;
    })
    .join("");
};

export const renderAdminCollection = async (root, config) => {
  setPageMetadata({
    title: `Admin · ${config.title} | MetsXMFanZone`,
    description: config.description,
    path: config.path,
  });
  const state = await requireAdmin(root, config.path);
  if (!state) return;

  const load = async () => {
    const { data, error } = await backend
      .from(config.table)
      .select("*")
      .order(config.orderBy || "created_at", { ascending: false })
      .limit(config.limit || 100);
    if (error) return { rows: [], error: error.message };
    return { rows: data || [], error: null };
  };

  let { rows, error } = await load();

  adminPage(
    root,
    config.path,
    config.title,
    `${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ""}
     <p class="admin-sub">${escapeHtml(config.description)}</p>
     <table class="admin-table"><tbody id="collection-rows">${rowsHtml(rows, config)}</tbody></table>`,
  );

  const tbody = root.querySelector("#collection-rows");
  if (!tbody) return;

  tbody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.closest("tr").dataset.id;
    const row = rows.find((item) => String(item.id) === id);
    button.disabled = true;

    if (button.dataset.action === "delete") {
      if (!window.confirm("Delete this item permanently?")) {
        button.disabled = false;
        return;
      }
      await backend.from(config.table).delete().eq("id", id);
    } else {
      const flag = button.dataset.flag;
      await backend
        .from(config.table)
        .update({ [flag]: !row[flag] })
        .eq("id", id);
    }

    ({ rows, error } = await load());
    tbody.innerHTML = rowsHtml(rows, config);
  });
};

export const adminCollections = [
  {
    path: "/admin/stories",
    table: "stories",
    title: "Stories",
    description: "Homepage and TV stories.",
    empty: "No stories yet.",
  },
  {
    path: "/admin/hero",
    table: "hero_slides",
    title: "Hero slides",
    description: "Slides shown at the top of the homepage.",
    empty: "No hero slides yet.",
  },
  {
    path: "/admin/videos",
    table: "videos",
    title: "Video gallery",
    description: "Videos published to the gallery.",
    empty: "No videos yet.",
  },
  {
    path: "/admin/podcasts",
    table: "podcasts",
    title: "Podcasts",
    description: "Podcast episodes.",
    empty: "No episodes yet.",
  },
  {
    path: "/admin/events",
    table: "events",
    title: "Events",
    description: "Fan events and watch parties.",
    empty: "No events yet.",
  },
  {
    path: "/admin/popups",
    table: "popup_notifications",
    title: "Popup alerts",
    description: "Site-wide popup messages.",
    empty: "No popup alerts yet.",
  },
  {
    path: "/admin/feedback",
    table: "feedbacks",
    title: "Feedback",
    description: "Feedback submitted by fans.",
    empty: "No feedback yet.",
  },
  {
    path: "/admin/support",
    table: "contact_submissions",
    title: "Support messages",
    description: "Messages from the contact and help forms.",
    empty: "No support messages yet.",
  },
  {
    path: "/admin/media",
    table: "media_library",
    title: "Media library",
    description: "Uploaded images and artwork.",
    empty: "No media uploaded yet.",
  },
  {
    path: "/admin/predictions",
    table: "daily_player_predictions",
    title: "Predictions",
    description: "Daily player predictions.",
    empty: "No predictions yet.",
  },
  {
    path: "/admin/lineups",
    table: "lineup_cards",
    title: "Lineup cards",
    description: "Published lineup cards.",
    empty: "No lineup cards yet.",
  },
];

/* ---------------- Roles ---------------- */

export const renderAdminRoles = async (root) => {
  const path = "/admin/roles";
  setPageMetadata({ title: "Admin · Roles | MetsXMFanZone", description: "Manage staff access.", path });
  const state = await requireAdmin(root, path);
  if (!state) return;

  const load = async () => {
    const { data } = await backend
      .from("user_roles")
      .select("id,user_id,role,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data || [];
  };

  const rows = (list) =>
    list
      .map(
        (item) => `
      <tr data-id="${escapeHtml(item.id)}">
        <td><strong>${escapeHtml(item.role)}</strong><span class="admin-sub">${escapeHtml(item.user_id)}</span></td>
        <td>${escapeHtml(shortDate(item.created_at))}</td>
        <td class="admin-actions"><button type="button" data-action="delete">Remove</button></td>
      </tr>`,
      )
      .join("") || '<tr><td colspan="3" class="empty-message">No roles assigned.</td></tr>';

  let list = await load();

  adminPage(
    root,
    path,
    "Roles",
    `<form class="stacked-form admin-create" id="role-form">
       <label>Member email<input name="email" type="email" required></label>
       <label>Role
         <select name="role">
           <option value="user">User</option>
           <option value="writer">Writer</option>
           <option value="moderator">Moderator</option>
           <option value="admin">Admin</option>
         </select>
       </label>
       <p class="form-error" id="role-error" hidden role="alert"></p>
       <div class="admin-create-actions"><button class="button primary" type="submit">Assign role</button></div>
     </form>
     <table class="admin-table"><tbody id="role-rows">${rows(list)}</tbody></table>`,
  );

  const tbody = root.querySelector("#role-rows");
  const form = root.querySelector("#role-form");
  const error = root.querySelector("#role-error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const role = String(data.get("role") || "user");

    const { data: profile } = await backend.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) {
      error.textContent = "No member found with that email address.";
      error.hidden = false;
      return;
    }
    const { error: insertError } = await backend.from("user_roles").insert({ user_id: profile.id, role });
    if (insertError) {
      error.textContent = insertError.message;
      error.hidden = false;
      return;
    }
    form.reset();
    list = await load();
    tbody.innerHTML = rows(list);
  });

  tbody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action=delete]");
    if (!button) return;
    button.disabled = true;
    await backend.from("user_roles").delete().eq("id", button.closest("tr").dataset.id);
    list = await load();
    tbody.innerHTML = rows(list);
  });
};

/* ---------------- Subscriptions ---------------- */

export const renderAdminSubscriptions = async (root) => {
  const path = "/admin/subscriptions";
  setPageMetadata({ title: "Admin · Subscriptions | MetsXMFanZone", description: "Membership overview.", path });
  const state = await requireAdmin(root, path);
  if (!state) return;

  const { data } = await backend
    .from("profiles")
    .select("id,full_name,subscription_tier,subscription_status,subscription_end_date,created_at")
    .order("subscription_end_date", { ascending: false })
    .limit(200);

  const members = data || [];
  const active = members.filter((member) => member.subscription_status === "active").length;

  adminPage(
    root,
    path,
    "Subscriptions",
    `<div class="stat-grid">
       <div class="stat-card"><strong>${active}</strong><span>Active memberships</span></div>
       <div class="stat-card"><strong>${members.length}</strong><span>Accounts</span></div>
     </div>
     <table class="admin-table"><tbody>
       ${
         members
           .map(
             (member) => `
         <tr>
           <td><strong>${escapeHtml(member.full_name || "Member")}</strong><span class="admin-sub">Joined ${escapeHtml(shortDate(member.created_at))}</span></td>
           <td><span class="pill ${member.subscription_status === "active" ? "is-live" : ""}">${escapeHtml(member.subscription_tier || "none")}</span></td>
           <td>Renews ${escapeHtml(shortDate(member.subscription_end_date))}</td>
         </tr>`,
           )
           .join("") || '<tr><td class="empty-message">No memberships yet.</td></tr>'
       }
     </tbody></table>`,
  );
};
