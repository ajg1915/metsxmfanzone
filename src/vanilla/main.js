import "./styles.css";
import { Router } from "./core/router.js";
import { renderBlog, renderBlogPost } from "./pages/blog.js";
import { publicStaticPaths, renderStaticPage } from "./pages/static.js";

const root = document.querySelector("#app");
if (!root) throw new Error("Missing application root");

const router = new Router(root);
router.add("/blog", () => renderBlog(root));
router.add("/blog/:slug", ({ params }) => renderBlogPost(root, params.slug));
publicStaticPaths.forEach((path) => router.add(path, ({ pathname }) => renderStaticPage(root, pathname)));
router.add("*", ({ pathname }) => renderStaticPage(root, pathname));
router.start();