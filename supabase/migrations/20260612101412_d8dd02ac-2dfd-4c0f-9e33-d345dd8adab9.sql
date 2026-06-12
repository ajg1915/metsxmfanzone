
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  reward_type text NOT NULL DEFAULT 'free_tshirt',
  status text NOT NULL DEFAULT 'pending',
  eligibility_start_date timestamptz,
  shipping_name text,
  shipping_address1 text,
  shipping_address2 text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text DEFAULT 'United States',
  shirt_size text,
  phone text,
  email_sent_at timestamptz,
  claimed_at timestamptz,
  opted_out_at timestamptz,
  shipped_at timestamptz,
  tracking_number text,
  carrier text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_user_id ON public.loyalty_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_status ON public.loyalty_rewards(status);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_token ON public.loyalty_rewards(claim_token);

GRANT SELECT, INSERT, UPDATE ON public.loyalty_rewards TO authenticated;
GRANT ALL ON public.loyalty_rewards TO service_role;

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards"
  ON public.loyalty_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own pending rewards"
  ON public.loyalty_rewards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert rewards"
  ON public.loyalty_rewards FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete rewards"
  ON public.loyalty_rewards FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER loyalty_rewards_updated_at
  BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
