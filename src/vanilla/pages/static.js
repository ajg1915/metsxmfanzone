import pageRegistry from "../../data/share-pages.json";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell } from "../ui/shell.js";

const copyByPath = {
  "/": {
    eyebrow: "The Ultimate Destination Where The Fans Go",
    heading: "New York Mets. Every Game. Every Story.",
    body: "Live coverage, original Mets news, podcasts, highlights, and community — built by fans, for fans.",
    actions: [["/metsxmfanzone", "Watch Live"], ["/blog", "Latest News"]],
  },
  "/podcast": {
    eyebrow: "MetsXMFanZone Podcast",
    heading: "Straight From The Fan Zone",
    body: "Game reactions, roster talk, interviews, and the Mets conversations fans care about.",
    actions: [["/community-podcast", "Explore Episodes"], ["/blog", "Mets News"]],
  },
  "/help-center": {
    eyebrow: "Support",
    heading: "How Can We Help?",
    body: "Find help with your account, membership, streams, app installation, and community features.",
    actions: [["/contact", "Contact Support"], ["/faqs", "Read FAQs"]],
  },
  "/pricing": {
    eyebrow: "Membership",
    heading: "Choose Your MetsXMFanZone Plan",
    body: "Get access to live games, replays, exclusive coverage, and member experiences.",
    actions: [["/auth", "Sign In"], ["/help/subscription-plans", "Compare Plans"]],
  },
  "/install": {
    eyebrow: "MetsXMFanZone App",
    heading: "Take The Fan Zone Anywhere",
    body: "Install the MetsXMFanZone app for quick access to streams, news, scores, and alerts.",
    actions: [["/", "Back Home"]],
  },
};

export const renderStaticPage = async (root, pathname) => {
  const record = pageRegistry.find((item) => item.path === pathname);
  const copy = copyByPath[pathname] || {
    eyebrow: record?.label || "MetsXMFanZone",
    heading: record?.title?.split("|")[0]?.trim() || "MetsXMFanZone",
    body: record?.description || "New York Mets coverage and community from MetsXMFanZone.",
    actions: [["/", "Back Home"], ["/blog", "Latest News"]],
  };

  setPageMetadata({
    title: record?.title || "MetsXMFanZone — New York Mets Fan Community",
    description: record?.description || copy.body,
    path: pathname,
    image: record?.image || "/og-image.jpg",
  });

  const content = `
    <section class="static-hero" style="--page-image: url('${escapeHtml(record?.image || "/og-image.jpg")}')">
      <div class="static-hero-overlay content-width">
        <p class="eyebrow">${escapeHtml(copy.eyebrow)}</p>
        <h1>${escapeHtml(copy.heading)}</h1>
        <p>${escapeHtml(copy.body)}</p>
        <div class="hero-actions">
          ${copy.actions.map(([href, label], index) => `<a class="button ${index === 0 ? "primary" : "secondary"}" href="${href}">${escapeHtml(label)}</a>`).join("")}
        </div>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

export const publicStaticPaths = pageRegistry.map((item) => item.path).filter((path) => path !== "/blog");