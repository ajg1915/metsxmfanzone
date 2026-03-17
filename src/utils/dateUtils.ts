/**
 * Get today's date in Eastern Time as YYYY-MM-DD string.
 * MLB schedules are ET-based, so we must use ET dates for all API calls.
 */
export function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Format a Date object to YYYY-MM-DD in Eastern Time.
 */
export function formatDateET(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
