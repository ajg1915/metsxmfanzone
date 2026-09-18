import { escapeHtml } from "../core/sanitize.js";

const navItems = [
  ["/", "Home"],
  ["/blog", "News"],
  ["/podcast", "Podcast"],
  ["/metsxmfanzone", "Watch"],
  ["/mets-schedule-2026", "Games"],
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
        <a class="account-link" href="/auth">Account</a>
      </nav>
    </header>
    <main id="page-content">${content}</main>
    <footer class="site-footer">
      <strong>MetsXMFanZone.com</strong>
      <nav aria-label="Footer navigation">
        <a href="/install">Install App</a><a href="/help-center">Help Center</a>
        <a href="/privacy">Privacy</a><a href="/terms">Terms</a>
      </nav>
      <p>VPN Secured · AES-256 Encrypted</p>
      <small>© ${new Date().getFullYear()} MetsXMFanZone.com. All rights reserved.</small>
    </footer>
  </div>`;

export const bindShell = (root) => {
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