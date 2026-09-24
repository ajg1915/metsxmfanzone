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

  return NY_TEAM_NAME_PATTERN.test(`${stream.title || ""} ${stream.description || ""}`);
};