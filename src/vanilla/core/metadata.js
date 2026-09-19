import pageRegistry from "../../data/share-pages.json";

const SITE_URL = "https://metsxmfanzone.com";
const SITE_NAME = "MetsXMFanZone";
const TWITTER_HANDLE = "@metsxmfanzone";
const DEFAULT_IMAGE = "/og-image.png";

const PRIVATE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/auth",
  "/logout",
  "/confirm-account",
  "/reset-password",
  "/payment-",
  "/paypal-success",
  "/unsubscribe",
];

const setMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
};

const setLink = (rel, href) => {
  let link = document.head.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.append(link);
  }
  link.href = href;
};

const registryImage = (path) => pageRegistry.find((entry) => entry.path === path)?.image;

export const setPageMetadata = ({
  title,
  description,
  path,
  image,
  imageAlt,
  type = "website",
  noindex,
}) => {
  const cleanPath = path && path !== "/" ? path.replace(/\/+$/, "") : "/";
  const canonicalUrl = new URL(cleanPath || "/", SITE_URL).toString();
  const chosenImage = image || registryImage(cleanPath) || DEFAULT_IMAGE;
  const imageUrl = /^https?:/i.test(chosenImage)
    ? chosenImage
    : new URL(chosenImage, SITE_URL).toString();
  const alt = imageAlt || `${title} — ${SITE_NAME}`;
  const isPrivate =
    noindex ?? PRIVATE_PREFIXES.some((prefix) => cleanPath.startsWith(prefix));
  const trimmedDescription =
    description && description.length > 160 ? `${description.slice(0, 157)}...` : description || "";

  document.title = title;

  setMeta('meta[name="description"]', { name: "description", content: trimmedDescription });
  setMeta('meta[name="robots"]', {
    name: "robots",
    content: isPrivate ? "noindex, nofollow" : "index, follow, max-image-preview:large",
  });

  setMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
  setMeta('meta[property="og:locale"]', { property: "og:locale", content: "en_US" });
  setMeta('meta[property="og:title"]', { property: "og:title", content: title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: trimmedDescription });
  setMeta('meta[property="og:type"]', { property: "og:type", content: type });
  setMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  setMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
  setMeta('meta[property="og:image:secure_url"]', { property: "og:image:secure_url", content: imageUrl });
  setMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: alt });
  setMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "1200" });
  setMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "630" });
  setMeta('meta[property="og:image:type"]', { property: "og:image:type", content: "image/png" });

  setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  setMeta('meta[name="twitter:site"]', { name: "twitter:site", content: TWITTER_HANDLE });
  setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: trimmedDescription });
  setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
  setMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt", content: alt });

  setLink("canonical", canonicalUrl);
};
