# MetsXMFanZone Cloudflare Cron Worker

Offloads high-frequency MLB / game cron jobs from Supabase `pg_cron` to a
Cloudflare Worker. Cloudflare Cron Triggers are free up to 5M invocations/month.

## 1. Deploy

```bash
cd cloudflare-worker/cron-worker
npm install -g wrangler
wrangler login
wrangler deploy
```

## 2. Set environment variables

Required secrets (run each command and paste the value when prompted):

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put CRON_SHARED_SECRET   # any random string, e.g. `openssl rand -hex 32`
```

`SUPABASE_URL` is already set as a plain var in `wrangler.toml`.

You can also set these from the Cloudflare dashboard:
**Workers & Pages → metsxmfanzone-cron → Settings → Variables and Secrets → Add**
(make sure to mark them as **Secret / Encrypted**, not plain text).

## 3. Where to find the values

| Secret | Where |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Lovable Cloud → backend → Settings → API → `service_role` key |
| `SUPABASE_ANON_KEY` | Same page → `anon` / `publishable` key (already in your `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY`) |
| `CRON_SHARED_SECRET` | Generate yourself, e.g. `openssl rand -hex 32` |

## 4. Disable the corresponding Supabase pg_cron jobs

After confirming the Worker runs successfully (check Cloudflare → Workers logs),
disable these jobs in Supabase to stop double-firing:

```sql
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
  'auto-game-alert-20min',
  'auto-game-alert-5min',
  'auto-game-alert-pregame',
  'auto-game-alert-morning',
  'check-final-scores',
  'scheduled-lineup-fetch-every-30min',
  'update-standings-daily',
  'auto-fetch-mets-news-daily',
  'auto-stream-status-daily'
);
```

**Keep these in Supabase** (they are low-frequency / auth-sensitive):
`process-email-queue`, `daily-subscription-expiry-check`,
`payment-enforcement-daily`, `send-review-emails-daily`,
`generate-daily-fanart`, `generate-daily-predictions`,
`generate-weekly-podcast-shows`.

## 5. Manual test

```bash
curl "https://metsxmfanzone-cron.<your-subdomain>.workers.dev/?secret=YOUR_SECRET&cron=0+6+*+*+*"
```
