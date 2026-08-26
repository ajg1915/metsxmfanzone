ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_type_check CHECK (plan_type = ANY (ARRAY['free'::text,'trial'::text,'weekly'::text,'premium'::text,'annual'::text]));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text,'cancelled'::text,'expired'::text,'pending'::text,'suspended'::text,'refunded'::text]));

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS paypal_plan_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_paypal_subscription_id_key ON public.subscriptions (paypal_subscription_id) WHERE paypal_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_paypal_order_id_idx ON public.subscriptions (paypal_order_id) WHERE paypal_order_id IS NOT NULL;