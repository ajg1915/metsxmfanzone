CREATE TABLE IF NOT EXISTS public.gameday_email_settings (
  trigger_type TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gameday_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read gameday email settings" ON public.gameday_email_settings;
CREATE POLICY "Public can read gameday email settings"
ON public.gameday_email_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage gameday email settings" ON public.gameday_email_settings;
CREATE POLICY "Admins can manage gameday email settings"
ON public.gameday_email_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.gameday_email_settings (trigger_type, enabled) VALUES
  ('pregame_20min', false),
  ('pregame_5min', false)
ON CONFLICT (trigger_type) DO NOTHING;