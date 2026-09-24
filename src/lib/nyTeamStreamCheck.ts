export const NY_TEAM_PAGES = [
  "ny-jets",
  "ny-giants",
  "ny-knicks",
  "ny-rangers",
  "ny-islanders",
  "brooklyn-nets",
] as const;

const NY_TEAM_NAME_PATTERN = /\b(?:new york\s+|ny\s+)?(?:jets|giants|knicks|rangers|islanders)\b|\b(?:brooklyn\s+)?nets\b/i;

export const isNYTeamStream = (stream: {
  title?: string | null;
  description?: string | null;
  assigned_pages?: string[] | null;
}) => {
  const assignedPages = (stream.assigned_pages || []).map((page) => page.toLowerCase());
  if (assignedPages.some((page) => NY_TEAM_PAGES.includes(page as (typeof NY_TEAM_PAGES)[number]))) {
    return true;
  }

  const eventText = `${stream.title || ""} ${stream.description || ""}`;
  // Avoid classifying Mets games against the Texas Rangers or San Francisco
  // Giants as NY football/hockey events. Explicit admin assignments above
  // remain authoritative for any intentional exception.
  if (/\bmets\b/i.test(eventText)) return false;

  return NY_TEAM_NAME_PATTERN.test(eventText);
};