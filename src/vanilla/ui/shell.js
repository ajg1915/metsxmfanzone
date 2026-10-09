import { escapeHtml } from "../core/sanitize.js";
import { auth } from "../core/auth.js";

const navItems = [
  ["/", "Home"],
  ["/blog", "News"],
  ["/podcast", "Podcast"],
  ["/metsxmfanzone", "Watch"],
  ["/mets-schedule-2026", "Games"],
];

// Keep in sync with: src/components/Footer.tsx and scripts/build-static-site.mjs
const footerQuick = [
  ["/metsxmfanzone", "Live"],
  ["/blog", "News"],
  ["/broadcast-schedule", "Schedule"],
  ["/podcast", "Podcast"],
  ["/pricing", "Plans"],
  ["/help-center", "Help"],
];
const footerColumns = [
  ["Watch", [["/metsxmfanzone", "Live Network"], ["/gameday-live", "Game Day Live"], ["/replay-games", "Game Replays"], ["/broadcast-schedule", "TV Schedule"], ["/tv", "TV Mode"]]],
  ["Read", [["/blog", "News"], ["/mets-game-recaps", "Game Recaps"], ["/mets-scores", "Scores"], ["/mets-schedule-2026", "2026 Schedule"], ["/mets-roster", "Roster"]]],
  ["Community", [["/community", "Community"], ["/podcast", "Podcast"], ["/gallery", "Highlights"], ["/social", "Follow Us"], ["/business-partner", "Business Partners"]]],
  ["Support", [["/help-center", "Help Center"], ["/faqs", "FAQ"], ["/contact", "Contact Us"], ["/pricing", "Plans & Pricing"], ["/install", "Install App"]]],
];
const svgIcon = (inner, filled = false) =>
  `<svg viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="${filled ? "none" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const footerSocials = [
  ["TikTok", "https://www.tiktok.com/@metsxmfanzone", svgIcon('<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.21 8.21 0 0 0 4.76 1.51v-3.45a4.85 4.85 0 0 1-1-.08z"/>', true)],
  ["Instagram", "https://www.instagram.com/metsxmfanzone", svgIcon('<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>')],
  ["Facebook", "https://www.facebook.com/metsxmfanzoneofficial", svgIcon('<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>')],
  ["X", "https://x.com/metsxmfanzone", svgIcon('<path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z"/>', true)],
  ["YouTube", "https://www.youtube.com/@metsxmfanzone", svgIcon('<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>')],
];

export const renderShell = ({ content, currentPath = window.location.pathname }) => `
  <div class="site-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="MetsXMFanZone home">
        <img src="/metsxmfanzone-logo.png" alt="" width="46" height="46">
        <span><b>Mets</b><em>XM</em>FanZone</span>
      </a>
      <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false">☰</button>
      <nav class="site-nav" aria-label="Primary navigation">
        ${navItems.map(([href, label]) => `<a href="${href}" ${currentPath === href ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
        <a class="account-link" href="${auth.state.user ? "/dashboard" : "/auth"}">${auth.state.user ? "My Account" : "Sign In"}</a>
        ${auth.state.isAdmin ? '<a class="account-link" href="/admin">Admin</a>' : ""}
        ${auth.state.user ? '<button class="account-link sign-out" type="button">Sign out</button>' : ""}
      </nav>
    </header>
    <main id="page-content">${content}</main>
    <footer class="site-footer">
      <div class="footer-top">
        <div class="footer-brand"><strong>MetsXMFanZone</strong><p>Fan-run coverage of the New York Mets</p></div>
        <div class="footer-social">${footerSocials.map(([name, url, icon]) => `<a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="MetsXMFanZone on ${name}">${icon}</a>`).join("")}</div>
        <a class="footer-app-btn" href="/install">Get the App</a>
      </div>
      <nav class="footer-quick" aria-label="Footer">
        ${footerQuick.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join("")}
      </nav>
      <div class="footer-legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/contact">Contact</a></div>
      <small>© ${new Date().getFullYear()} MetsXMFanZone. Not affiliated with MLB or the New York Mets.</small>
    </footer>
  </div>`;

export const bindShell = (root) => {
  const signOut = root.querySelector(".sign-out");
  signOut?.addEventListener("click", async () => {
    await auth.signOut();
    window.location.assign("/");
  });
  const toggle = root.querySelector(".menu-toggle");
  const nav = root.querySelector(".site-nav");
  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    nav?.classList.toggle("is-open", open);
  });
};

export const statusPanel = (title, message, action) => `
  <section class="content-width status-panel">
    <p class="eyebrow">${escapeHtml(title)}</p>
    <h1>${escapeHtml(message)}</h1>
    ${action ? `<a class="button primary" href="${action.href}">${escapeHtml(action.label)}</a>` : ""}
  </section>`;