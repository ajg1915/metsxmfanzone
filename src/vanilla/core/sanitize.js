const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

export const safeUrl = (value, fallback = "#") => {
  try {
    const url = new URL(value, window.location.origin);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
};

export const sanitizeArticleHtml = (html = "") => {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set([
    "A", "BLOCKQUOTE", "BR", "CODE", "DIV", "EM", "H2", "H3", "H4", "HR", "I", "IMG",
    "LI", "OL", "P", "PRE", "SPAN", "STRONG", "UL",
  ]);
  const allowedAttributes = new Set(["alt", "class", "href", "rel", "src", "target", "title"]);

  [...template.content.querySelectorAll("*")].forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => {
      if (!allowedAttributes.has(attribute.name)) element.removeAttribute(attribute.name);
    });
    if (element instanceof HTMLAnchorElement) {
      element.href = safeUrl(element.getAttribute("href") || "");
      element.rel = "noopener noreferrer";
    }
    if (element instanceof HTMLImageElement) {
      element.src = safeUrl(element.getAttribute("src") || "", "/placeholder.svg");
      element.loading = "lazy";
    }
  });

  return template.innerHTML;
};