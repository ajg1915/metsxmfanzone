import "./styles.css";
import { Router } from "./core/router.js";
import { auth } from "./core/auth.js";
import { renderHome } from "./pages/home.js";
import { renderBlog, renderBlogPost } from "./pages/blog.js";
import { renderAuth } from "./pages/auth.js";
import { renderDashboard, renderPlans } from "./pages/account.js";
import { renderLiveStream, renderWatchPage, watchPaths } from "./pages/watch.js";
import { renderPodcast, renderRecap, renderRecaps, renderVideoGallery } from "./pages/media.js";
import { renderCommunity } from "./pages/community.js";
import { renderSchedule, renderScores } from "./pages/games.js";
import {
  renderAdminBlog,
  renderAdminCommunity,
  renderAdminHome,
  renderAdminStreams,
  renderAdminUsers,
} from "./pages/admin.js";
import {
  adminCollections,
  renderAdminCollection,
  renderAdminRoles,
  renderAdminSubscriptions,
} from "./pages/adminExtra.js";
import { formPaths, renderFormPage } from "./pages/forms.js";
import { publicStaticPaths, renderStaticPage } from "./pages/static.js";
import { helpRoutes } from "./pages/helpPages.js";
import { accountRoutes } from "./pages/accountPages.js";
import { gameRoutes } from "./pages/gamePages.js";

const root = document.querySelector("#app");
if (!root) throw new Error("Missing application root");

const router = new Router(root);

// Dynamic pages
router.add("/", () => renderHome(root));
router.add("/blog", () => renderBlog(root));
router.add("/blog/:slug", ({ params }) => renderBlogPost(root, params.slug));
router.add("/auth", () => renderAuth(root));
router.add("/dashboard", () => renderDashboard(root));
router.add("/plans", ({ pathname }) => renderPlans(root, pathname));
router.add("/pricing", ({ pathname }) => renderPlans(root, pathname));
router.add("/community", ({ pathname }) => renderCommunity(root, pathname));
router.add("/podcast", ({ pathname }) => renderPodcast(root, pathname));
router.add("/community-podcast", ({ pathname }) => renderPodcast(root, pathname));
router.add("/video-gallery", ({ pathname }) => renderVideoGallery(root, pathname));
router.add("/gallery", ({ pathname }) => renderVideoGallery(root, pathname));
router.add("/mets-game-recaps", ({ pathname }) => renderRecaps(root, pathname));
router.add("/mets-game-recaps/:slug", ({ params }) => renderRecap(root, params.slug));
router.add("/mets-schedule-2026", ({ pathname }) => renderSchedule(root, pathname));
router.add("/broadcast-schedule", ({ pathname }) => renderSchedule(root, pathname));
router.add("/mets-scores", ({ pathname }) => renderScores(root, pathname));
router.add("/nl-scores", ({ pathname }) => renderScores(root, pathname));
router.add("/live/:id", ({ params }) => renderLiveStream(root, params.id));
router.add("/admin", () => renderAdminHome(root));
router.add("/admin/blog", () => renderAdminBlog(root));
router.add("/admin/streams", () => renderAdminStreams(root));
router.add("/admin/community", () => renderAdminCommunity(root));
router.add("/admin/users", () => renderAdminUsers(root));
router.add("/admin/roles", () => renderAdminRoles(root));
router.add("/admin/subscriptions", () => renderAdminSubscriptions(root));
adminCollections.forEach((config) => router.add(config.path, () => renderAdminCollection(root, config)));
formPaths.forEach((path) => router.add(path, ({ pathname }) => renderFormPage(root, pathname)));
watchPaths.forEach((path) => router.add(path, ({ pathname }) => renderWatchPage(root, pathname)));

// Remaining informational pages from the shared page registry
const dynamicPaths = new Set(router.routes.map((route) => route.pattern));
publicStaticPaths
  .filter((path) => !dynamicPaths.has(path))
  .forEach((path) => router.add(path, ({ pathname }) => renderStaticPage(root, pathname)));

router.add("*", ({ pathname }) => renderStaticPage(root, pathname));

await auth.start();
router.start();
