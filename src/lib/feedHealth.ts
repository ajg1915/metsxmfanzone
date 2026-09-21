// The feed-health checker runs on the Lovable functions host, which is separate
// from the main app backend, so it is called directly by URL.
const FEED_HEALTH_URL = "https://clwghkbtkofacsjeyrtk.supabase.co/functions/v1/feed-health";
const FEED_HEALTH_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsd2doa2J0a29mYWNzamV5cnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTI3NDIsImV4cCI6MjA3NzkyODc0Mn0.11mr9r-U-BAwy9Mmr2yrzjLhjljswgOotJeOOXyfllc";

export async function fetchFeedHealth(): Promise<any> {
  const res = await fetch(FEED_HEALTH_URL, {
    headers: {
      apikey: FEED_HEALTH_KEY,
      Authorization: `Bearer ${FEED_HEALTH_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Feed check failed (${res.status})`);
  return res.json();
}
