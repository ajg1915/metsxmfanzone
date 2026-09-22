// Dependency-free HTML sanitizer for outbound email content.
// Allowlist-based: strips scripts, styles, event handlers, and unsafe URLs.

const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "ol", "p", "pre", "small", "span", "strong", "sub", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "center", "font",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  td: new Set(["colspan", "rowspan", "align", "valign", "width"]),
  th: new Set(["colspan", "rowspan", "align", "valign", "width"]),
  table: new Set(["width", "align", "cellpadding", "cellspacing", "border"]),
  font: new Set(["color", "size", "face"]),
};

const GLOBAL_ATTRS = new Set(["style", "align", "dir", "lang"]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

export const escapeHtml = (str: string): string => {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m] || m));
};

const isSafeUrl = (value: string): boolean => {
  const url = value.trim().replace(/[\u0000-\u001F\u007F]/g, "").toLowerCase();
  if (url.startsWith("javascript:") || url.startsWith("vbscript:")) return false;
  if (url.startsWith("data:") && !url.startsWith("data:image/")) return false;
  return true;
};

const sanitizeStyle = (value: string): string =>
  value.replace(/expression\s*\(/gi, "").replace(/url\s*\(\s*['"]?\s*javascript:/gi, "");

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const sanitizeAttributes = (tag: string, rawAttrs: string): string => {
  const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
  const out: string[] = [];
  let match: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((match = ATTR_RE.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    if (name.startsWith("on")) continue;
    if (!allowed.has(name) && !GLOBAL_ATTRS.has(name)) continue;
    if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;
    const safeValue = name === "style" ? sanitizeStyle(value) : value;
    out.push(`${name}="${escapeHtml(safeValue)}"`);
  }
  if (tag === "a") {
    if (!out.some((a) => a.startsWith("rel="))) out.push('rel="noopener noreferrer"');
  }
  return out.length ? ` ${out.join(" ")}` : "";
};

export const sanitizeHtml = (html: string): string => {
  if (!html) return "";

  // Remove dangerous elements together with their content.
  let cleaned = html.replace(
    /<\s*(script|style|iframe|object|embed|noscript|template|svg|math|form|input|button|select|textarea)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  cleaned = cleaned.replace(
    /<\s*\/?\s*(script|style|iframe|object|embed|noscript|template|svg|math|form|input|button|select|textarea)\b[^>]*>/gi,
    "",
  );
  // Drop comments and doctype/processing instructions.
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "").replace(/<![^>]*>/g, "");

  return cleaned.replace(
    /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g,
    (_full, closing: string | undefined, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      const attrs = sanitizeAttributes(tag, rawAttrs || "");
      return VOID_TAGS.has(tag) ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
    },
  );
};
