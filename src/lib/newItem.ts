// Helpers for the small "new" badges shown on cards across the site.

export const NEW_ITEM_HOURS = 48;

/** True when the date is within the last `hours` hours (default 48). */
export const isFresh = (date: string | null | undefined, hours: number = NEW_ITEM_HOURS): boolean => {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  const age = Date.now() - t;
  return age >= 0 && age < hours * 60 * 60 * 1000;
};

/** True when the date is coming up within the next `hours` hours, or started in the last hour. */
export const startsSoon = (date: string | null | undefined, hours: number = 3): boolean => {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  const diff = t - Date.now();
  return diff < hours * 60 * 60 * 1000 && diff > -60 * 60 * 1000;
};
