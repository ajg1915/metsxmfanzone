const SITE_URL = "https://metsxmfanzone.com";

const setMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
};

export const setPageMetadata = ({ title, description, path, image = "/og-image.jpg", type = "website" }) => {
  const canonicalUrl = new URL(path || "/", SITE_URL).toString();
  const imageUrl = new URL(image, SITE_URL).toString();
  document.title = title;

  setMeta('meta[name="description"]', { name: "description", content: description });
  setMeta('meta[property="og:title"]', { property: "og:title", content: title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: description });
  setMeta('meta[property="og:type"]', { property: "og:type", content: type });
  setMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  setMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
  setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = canonicalUrl;
};