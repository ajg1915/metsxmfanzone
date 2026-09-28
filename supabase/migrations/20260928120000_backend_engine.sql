-- MetsXMFanZone backend engine: PayPal event log, past_due state, admin
-- alerts, daily health log, subscriber metrics, cleanup and schedules.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Subscriptions: add a past_due state (payment failed, still in grace)
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY['active','past_due','cancelled','expired','pending','suspended','refunded']));

-- A past_due member keeps access for 3 days after their paid-through date
-- while PayPal retries the card. After that, access stops on its own.
-- A cancelled member keeps access until their paid-through date. Admin
-- "cancel immediately" and account deletion set end_date to now, so those
-- still cut access at once.
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND plan_type IN ('weekly', 'premium', 'annual')
      AND (
        (status = 'active' AND (end_date IS NULL OR end_date > now()))
        OR (status = 'past_due' AND end_date + interval '3 days' > now())
        OR (status = 'cancelled' AND end_date > now())
      )
  )
$function$;

-- One row per PayPal payment, so a redelivered PAYMENT.SALE.COMPLETED can't
-- extend a membership twice.
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS paypal_sale_id text;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_paypal_sale_id_key
  ON public.subscription_payments (paypal_sale_id) WHERE paypal_sale_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. PayPal webhook event log (idempotency + retry queue)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.paypal_webhook_events (
  id text PRIMARY KEY,                       -- PayPal's event id (WH-...)
  event_type text NOT NULL,
  resource_id text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS paypal_webhook_events_status_idx
  ON public.paypal_webhook_events (status, received_at);
ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read PayPal events" ON public.paypal_webhook_events;
CREATE POLICY "Admins can read PayPal events" ON public.paypal_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 3. Admin alerts (dedupe so a rumor or final score alerts once)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  kind text NOT NULL,                        -- rumor | postgame | morning | health | billing
  title text NOT NULL,
  body text,
  payload jsonb,
  channels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read alerts" ON public.admin_alerts;
CREATE POLICY "Admins can read alerts" ON public.admin_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 4. Daily "Site Health & Fixes Log"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_health_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  checks jsonb NOT NULL,
  fixes jsonb NOT NULL,
  metrics jsonb,
  summary text NOT NULL
);
CREATE INDEX IF NOT EXISTS site_health_runs_ran_at_idx ON public.site_health_runs (ran_at DESC);
ALTER TABLE public.site_health_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read health runs" ON public.site_health_runs;
CREATE POLICY "Admins can read health runs" ON public.site_health_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 5. Subscriber metrics for a window [p_from, p_to)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subscriber_metrics(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH paid AS (
    SELECT *,
      COALESCE(amount, CASE plan_type WHEN 'annual' THEN 129.99 WHEN 'weekly' THEN 3.99
                                      WHEN 'ny_sports' THEN 19.99 ELSE 9.99 END) AS price
    FROM public.subscriptions
    WHERE plan_type IN ('weekly', 'premium', 'annual', 'ny_sports')
  ),
  active AS (
    SELECT * FROM paid
    WHERE status IN ('active', 'past_due') AND (end_date IS NULL OR end_date > p_to)
  ),
  churned AS (
    SELECT * FROM paid
    WHERE status IN ('cancelled', 'expired', 'refunded')
      AND COALESCE(cancellation_requested_at, updated_at) >= p_from
      AND COALESCE(cancellation_requested_at, updated_at) < p_to
  ),
  signups AS (
    SELECT * FROM paid WHERE created_at >= p_from AND created_at < p_to
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'active_subs', (SELECT count(*) FROM active),
    'past_due', (SELECT count(*) FROM active WHERE status = 'past_due'),
    'by_plan', (SELECT COALESCE(jsonb_object_agg(plan_type, n), '{}') FROM
                 (SELECT plan_type, count(*) n FROM active GROUP BY 1) t),
    'mrr', (SELECT round(COALESCE(sum(CASE plan_type
                 WHEN 'weekly' THEN price * 52 / 12
                 WHEN 'annual' THEN price / 12
                 ELSE price END), 0), 2) FROM active),
    'new_signups', (SELECT count(*) FROM signups),
    'new_members', (SELECT count(*) FROM public.profiles WHERE created_at >= p_from AND created_at < p_to),
    'churned', (SELECT count(*) FROM churned),
    -- churn rate = lost / (active at end + lost - gained)
    'churn_rate', (SELECT round(
        (SELECT count(*) FROM churned)::numeric /
        NULLIF((SELECT count(*) FROM active) + (SELECT count(*) FROM churned)
               - (SELECT count(*) FROM signups), 0), 4)),
    'revenue', (SELECT round(COALESCE(sum(amount), 0), 2) FROM public.subscription_payments
                 WHERE status = 'completed' AND payment_date >= p_from AND payment_date < p_to)
  )
$function$;
REVOKE ALL ON FUNCTION public.subscriber_metrics(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscriber_metrics(timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Light nightly cleanup (called by daily-health-check)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_daily_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '{}';
  n int;
BEGIN
  DELETE FROM public.email_confirmation_tokens WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('email_confirmation_tokens', n);

  DELETE FROM public.oauth_csrf_tokens WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('oauth_csrf_tokens', n);

  DELETE FROM public.webauthn_challenges WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('webauthn_challenges', n);

  DELETE FROM public.admin_verification_codes WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('admin_verification_codes', n);

  DELETE FROM public.admin_login_attempts WHERE attempted_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('admin_login_attempts', n);

  DELETE FROM public.paypal_webhook_events
   WHERE status IN ('processed', 'ignored') AND received_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('paypal_webhook_events', n);

  -- The every-minute email queue job alone writes ~1,440 rows a day here.
  DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('cron_job_run_details', n);

  RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.run_daily_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_cleanup() TO service_role;

-- Cron jobs that failed in the last 24h, for the health report.
CREATE OR REPLACE FUNCTION public.cron_failures_24h()
RETURNS TABLE (jobname text, failed bigint, last_error text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT j.jobname, count(*), max(d.return_message)
  FROM cron.job_run_details d JOIN cron.job j USING (jobid)
  WHERE d.status = 'failed' AND d.start_time > now() - interval '24 hours'
  GROUP BY j.jobname
$function$;
REVOKE ALL ON FUNCTION public.cron_failures_24h() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_failures_24h() TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Schedules. New functions check the x-cron-secret header, whose value
--    lives in Vault:  select vault.create_secret('<random>', 'cron_secret');
--    pg_cron runs in UTC; "ET" times below are EDT and shift an hour in winter.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.call_edge_function(fn text, body jsonb DEFAULT '{}')
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT net.http_post(
    url := 'https://rdmrxeplasttewtlfetc.supabase.co/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := body,
    timeout_milliseconds := 55000
  )
$function$;
REVOKE ALL ON FUNCTION public.call_edge_function(text, jsonb) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN
    ('payment-enforcement-daily', 'news-radar', 'postgame-prompt', 'morning-brief');
END $$;

-- Payment enforcement exists but was never scheduled. 9 AM ET.
SELECT cron.schedule('payment-enforcement-daily', '0 13 * * *',
  $$SELECT public.call_edge_function('payment-enforcement')$$);
-- Trade rumor / breaking news radar.
SELECT cron.schedule('news-radar', '*/10 * * * *',
  $$SELECT public.call_edge_function('news-radar')$$);
-- Post-game prompt: detects games that just went Final.
SELECT cron.schedule('postgame-prompt', '*/10 * * * *',
  $$SELECT public.call_edge_function('admin-prompts', '{"mode":"postgame"}')$$);
-- Morning brief at 8 AM ET.
SELECT cron.schedule('morning-brief', '0 12 * * *',
  $$SELECT public.call_edge_function('admin-prompts', '{"mode":"morning"}')$$);
-- The midnight health check is triggered by the Cloudflare Worker, so it
-- still reports when Supabase itself is down.
