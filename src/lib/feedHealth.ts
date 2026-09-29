// The feed-health checker runs on the personal Supabase project (rdmrxeplasttewtlfetc).
const FEED_HEALTH_URL = "https://rdmrxeplasttewtlfetc.supabase.co/functions/v1/feed-health";
const FEED_HEALTH_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

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
