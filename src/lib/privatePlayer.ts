export const PRIVATE_PLAYER_SETTING_KEY = "admin_private_player";

export type PrivatePlayerConfig = {
  enabled: boolean;
  title: string;
  iframeUrl: string;
  rawEmbed: string;
};

export const PRIVATE_PLAYER_DEFAULTS: PrivatePlayerConfig = {
  enabled: true,
  title: "Admin Private Player",
  iframeUrl: "",
  rawEmbed: "",
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export const extractIframeSrc = (raw: string): string | null => {
  if (!raw?.trim()) return null;

  const normalized = decodeHtmlEntities(raw.trim());
  const quotedMatch = normalized.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);
  if (quotedMatch?.[2]) return quotedMatch[2].trim();

  const unquotedMatch = normalized.match(/<iframe\b[^>]*\bsrc\s*=\s*([^\s>]+)/i);
  if (unquotedMatch?.[1]) return unquotedMatch[1].trim();

  return null;
};

const normalizeUrl = (value: string): string | null => {
  const candidate = decodeHtmlEntities(value.trim());
  if (!candidate || candidate.startsWith("<")) return null;

  if (candidate.startsWith("//")) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
    return `${protocol}${candidate}`;
  }

  if (candidate.startsWith("/")) return candidate;

  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }

  return null;
};

export const getPrivatePlayerIframeUrl = (cfg: PrivatePlayerConfig): string | null => {
  const urlField = cfg.iframeUrl?.trim() ?? "";
  const embedField = cfg.rawEmbed?.trim() ?? "";

  return (
    normalizeUrl(extractIframeSrc(urlField) ?? urlField) ??
    normalizeUrl(extractIframeSrc(embedField) ?? embedField)
  );
};

export const getPrivatePlayerSourceError = (cfg: PrivatePlayerConfig): string | null => {
  const hasInput = Boolean(cfg.iframeUrl?.trim() || cfg.rawEmbed?.trim());
  if (!hasInput || getPrivatePlayerIframeUrl(cfg)) return null;
  return "Paste a valid embed URL or full iframe code with a src attribute.";
};