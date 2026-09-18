const normalizePath = (pathname) => {
  const clean = pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return clean || "/";
};

const compilePattern = (pattern) => {
  const keys = [];
  const expression = pattern
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        keys.push(part.slice(1));
        return "([^/]+)";
      }
      if (part === "*") {
        keys.push("wildcard");
        return "(.*)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return { keys, regex: new RegExp(`^${expression}/?$`) };
};

export class Router {
  constructor(root) {
    this.root = root;
    this.routes = [];
    this.onNavigate = this.onNavigate.bind(this);
  }

  add(pattern, render) {
    this.routes.push({ pattern, render, ...compilePattern(pattern) });
    return this;
  }

  start() {
    document.addEventListener("click", this.onNavigate);
    window.addEventListener("popstate", () => this.render());
    return this.render();
  }

  async render() {
    const pathname = normalizePath(window.location.pathname);
    const route = this.routes.find((candidate) => candidate.regex.test(pathname));

    if (!route) {
      window.location.replace("/");
      return;
    }

    const match = pathname.match(route.regex);
    const params = Object.fromEntries(
      route.keys.map((key, index) => [key, decodeURIComponent(match?.[index + 1] || "")]),
    );

    this.root.setAttribute("aria-busy", "true");
    try {
      await route.render({ params, pathname, search: new URLSearchParams(window.location.search) });
    } finally {
      this.root.removeAttribute("aria-busy");
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  onNavigate(event) {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (link.target || link.download || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    this.render();
  }
}