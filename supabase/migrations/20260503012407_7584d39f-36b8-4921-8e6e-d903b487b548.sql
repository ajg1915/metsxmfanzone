SELECT cron.schedule(
  'fetch-mets-lineup-every-30min',
  '*/30 * * * *',
  $$SELECT net.http_post(
      url := 'https://clwghkbtkofacsjeyrtk.supabase.co/functions/v1/fetch-mets-lineup',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );$$
);