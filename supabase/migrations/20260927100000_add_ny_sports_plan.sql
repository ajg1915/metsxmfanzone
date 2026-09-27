-- Allow the separate NY Sports Streaming add-on plan ($19.99/month).
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_type_check
  CHECK (plan_type = ANY (ARRAY['free'::text, 'trial'::text, 'weekly'::text, 'premium'::text, 'annual'::text, 'ny_sports'::text]));
