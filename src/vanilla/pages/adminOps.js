import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { adminPage, requireAdmin, shortDate } from "./admin.js";
import { renderAdminCollection } from "./adminExtra.js";

/* ---------------- Feed Health ---------------- */

export const renderAdminFeedHealth = async (root) => {
  const path = "/admin/feed-health";
  setPageMetadata({ title: "Admin · Feed Health | MetsXMFanZone", description: "Monitor external feeds.", path });
  const state = await requireAdmin(root, path);
  if (!state) return;

  const FEED_HEALTH_URL = "https://clwghkbtkofacsjeyrtk.supabase.co/functions/v1/feed-health";
  const FEED_HEALTH_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsd2doa2J0a29mYWNzamV5cnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTI3NDIsImV4cCI6MjA3NzkyODc0Mn0.11mr9r-U-BAwy9Mmr2yrzjLhjljswgOotJeOOXyfllc";

  adminPage(root, path, "Feed Health", '<div id="feed-status" class="status-panel">Checking feed health...</div>');
  const panel = root.querySelector("#feed-status");

  try {
    const res = await fetch(FEED_HEALTH_URL, {
      headers: { apikey: FEED_HEALTH_KEY, Authorization: `Bearer ${FEED_HEALTH_KEY}` },
    });
    if (!res.ok) throw new Error(`Feed check failed (${res.status})`);
    const data = await res.json();
    
    panel.innerHTML = `
      <div class="stat-grid">
        ${(data.feeds || []).map(f => `
          <div class="stat-card">
            <strong>${escapeHtml(f.status || 'Unknown')}</strong>
            <span>${escapeHtml(f.name)}</span>
            <small class="admin-sub">${f.last_check ? new Date(f.last_check).toLocaleTimeString() : 'Never'}</small>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    panel.innerHTML = `<p class="form-error">${escapeHtml(err.message)}</p>`;
  }
};

/* ---------------- Trials & Promos ---------------- */

export const renderAdminTrials = async (root) => {
  const path = "/admin/trials";
  setPageMetadata({ title: "Admin · Trials | MetsXMFanZone", description: "Manage free access.", path });
  const state = await requireAdmin(root, path);
  if (!state) return;

  const key = "free_trial_config";
  const { data } = await backend.from("site_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  const config = data?.setting_value || { enabled: false, trialDays: 7 };

  adminPage(root, path, "Trials & Promos", `
    <form class="stacked-form admin-create" id="trial-form">
      <label class="checkbox-label"><input type="checkbox" name="enabled" ${config.enabled ? "checked" : ""}> Enable standard free trial</label>
      <label>Trial length (days)<input name="trialDays" type="number" value="${config.trialDays || 7}"></label>
      <p class="form-error" id="trial-error" hidden></p>
      <div class="admin-create-actions"><button class="button primary" type="submit">Save settings</button></div>
    </form>`);

  root.querySelector("#trial-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { enabled: fd.get("enabled") === "on", trialDays: parseInt(fd.get("trialDays")) || 7 };
    const { error } = await backend.from("site_settings").upsert({ setting_key: key, setting_value: payload, is_public: true }, { onConflict: "setting_key" });
    if (error) alert(error.message); else alert("Saved successfully.");
  });
};

/* ---------------- User Management ---------------- */

export const renderAdminUserManagement = async (root) => {
  const path = "/admin/user-management";
  setPageMetadata({ title: "Admin · Members | MetsXMFanZone", description: "Member directory.", path });
  const state = await requireAdmin(root, path);
  if (!state) return;

  const { data } = await backend.from("profiles").select("id,full_name,email,subscription_tier,created_at").limit(100);
  const rows = (data || []).map(u => `
    <tr>
      <td><strong>${escapeHtml(u.full_name || 'Member')}</strong><span class="admin-sub">${escapeHtml(u.email || u.id)}</span></td>
      <td><span class="pill">${escapeHtml(u.subscription_tier || 'free')}</span></td>
      <td>${escapeHtml(shortDate(u.created_at))}</td>
    </tr>`).join('') || '<tr><td colspan="3" class="empty-message">No members found.</td></tr>';

  adminPage(root, path, "User Management", `<table class="admin-table"><tbody>${rows}</tbody></table>`);
};

/* ---------------- Helpers & Routes ---------------- */

const wrap = (fn) => (root, ctx) => fn(root);

export const adminOpsRoutes = [
  { path: "/admin/settings", render: wrap(root => adminPage(root, "/admin/settings", "Settings", '<p class="empty-message">Site settings are managed in the main database.</p>')) },
  { path: "/admin/seo", render: (root) => renderAdminCollection(root, { path: "/admin/seo", table: "seo_settings", title: "SEO", description: "Meta tags and search optimization.", empty: "No SEO settings.", titleKeys: ["page_name", "page_path"] }) },
  { path: "/admin/realtime-analytics", render: wrap(root => adminPage(root, "/admin/realtime-analytics", "Real-time Analytics", '<p class="empty-message">Live traffic and presence data.</p>')) },
  { path: "/admin/activity", render: (root) => renderAdminCollection(root, { path: "/admin/activity", table: "activity_logs", title: "Activity", description: "Recent system and admin logs.", empty: "No logs yet.", titleKeys: ["action", "log_type"], metaKeys: ["ip_address"] }) },
  { path: "/admin/daily-reports", render: wrap(root => adminPage(root, "/admin/daily-reports", "Daily Reports", '<p class="empty-message">Summary reports are generated at midnight ET.</p>')) },
  { path: "/admin/feed-health", render: wrap(renderAdminFeedHealth) },
  { path: "/admin/stream-health", render: wrap(root => adminPage(root, "/admin/stream-health", "Stream Health", '<p class="empty-message">Real-time health monitoring for live ingest.</p>')) },
  { path: "/admin/stream-tester", render: wrap(root => adminPage(root, "/admin/stream-tester", "Stream Tester", '<p class="empty-message">Test players for all available bitrates.</p>')) },
  { path: "/admin/live-streams", render: (root) => renderAdminCollection(root, { path: "/admin/live-streams", table: "live_streams", title: "Streams", description: "Manage broadcast events.", empty: "No streams.", statusKeys: ["status"] }) },
  { path: "/admin/live-notifications", render: (root) => renderAdminCollection(root, { path: "/admin/live-notifications", table: "live_notifications", title: "Live Alerts", description: "Real-time alerts for active viewers.", empty: "No alerts.", titleKeys: ["message"] }) },
  { path: "/admin/game-alerts", render: (root) => renderAdminCollection(root, { path: "/admin/game-alerts", table: "game_alerts", title: "Game Alerts", description: "Mobile push and site alerts.", empty: "No game alerts.", titleKeys: ["title", "message"] }) },
  { path: "/admin/game-notifications", render: (root) => renderAdminCollection(root, { path: "/admin/game-notifications", table: "game_notifications", title: "In-Game", description: "Automated scoring and inning alerts.", empty: "No notifications." }) },
  { path: "/admin/popup-notifications", render: (root) => renderAdminCollection(root, { path: "/admin/popup-notifications", table: "popup_notifications", title: "Popups", description: "Site-wide modal messages.", empty: "No popups." }) },
  { path: "/admin/toast-prompts", render: (root) => renderAdminCollection(root, { path: "/admin/toast-prompts", table: "toast_prompts", title: "Toasts", description: "Transient corner notifications.", empty: "No toast prompts.", titleKeys: ["name", "title"] }) },
  { path: "/admin/welcome-screen", render: wrap(root => adminPage(root, "/admin/welcome-screen", "Welcome Screen", '<p class="empty-message">Onboarding gate for new visitors.</p>')) },
  { path: "/admin/email-editor", render: wrap(root => adminPage(root, "/admin/email-editor", "Email Editor", '<p class="empty-message">Design and send bulk newsletters.</p>')) },
  { path: "/admin/email-templates", render: wrap(root => adminPage(root, "/admin/email-templates", "Email Templates", '<p class="empty-message">System notification styles.</p>')) },
  { path: "/admin/user-management", render: wrap(renderAdminUserManagement) },
  { path: "/admin/trials", render: wrap(renderAdminTrials) },
  { path: "/admin/writer-applications", render: (root) => renderAdminCollection(root, { path: "/admin/writer-applications", table: "writer_applications", title: "Writer Apps", description: "Submissions for staff writer access.", empty: "No writer apps.", titleKeys: ["full_name", "email"] }) },
  { path: "/admin/podcaster-applications", render: (root) => renderAdminCollection(root, { path: "/admin/podcaster-applications", table: "podcaster_applications", title: "Podcaster Apps", description: "Applications for the community studio.", empty: "No podcaster apps.", titleKeys: ["full_name", "podcast_topic"] }) },
  { path: "/admin/feedbacks", render: (root) => renderAdminCollection(root, { path: "/admin/feedbacks", table: "feedbacks", title: "Feedback", description: "User-submitted suggestions.", empty: "No feedback." }) },
  { path: "/admin/business-ads", render: (root) => renderAdminCollection(root, { path: "/admin/business-ads", table: "business_ads", title: "Ads", description: "Partner and community ads.", empty: "No ads.", titleKeys: ["business_name", "ad_title"] }) },
  { path: "/admin/tutorials", render: (root) => renderAdminCollection(root, { path: "/admin/tutorials", table: "tutorial_steps", title: "Tutorials", description: "Onboarding walkthrough steps.", empty: "No tutorial steps.", orderBy: "step_number" }) },
  { path: "/admin/ai-assistant", render: wrap(root => adminPage(root, "/admin/ai-assistant", "AI Assistant", '<p class="empty-message">Content generation and moderation tools.</p>')) },
  { path: "/admin/studio", render: wrap(root => adminPage(root, "/admin/studio", "Clubhouse Studio", '<p class="empty-message">Host and record live podcasts.</p>')) },
];
