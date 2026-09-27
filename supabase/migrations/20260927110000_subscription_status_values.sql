-- The PayPal webhook writes 'suspended' (failed payments) and 'refunded';
-- the old check rejected them, so those updates silently failed.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text, 'pending'::text, 'suspended'::text, 'refunded'::text]));
