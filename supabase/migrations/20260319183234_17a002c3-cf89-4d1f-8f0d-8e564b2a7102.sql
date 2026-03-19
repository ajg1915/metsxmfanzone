CREATE TABLE public.email_template_settings (
  id integer PRIMARY KEY DEFAULT 1,
  logo_url text NOT NULL DEFAULT 'https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/metsxmfanzone-logo.png',
  primary_color text NOT NULL DEFAULT '#FF5910',
  card_bg_color text NOT NULL DEFAULT '#1a1a2e',
  body_bg_color text NOT NULL DEFAULT '#0a0a0a',
  heading_color text NOT NULL DEFAULT '#ffffff',
  text_color text NOT NULL DEFAULT '#d1d5db',
  footer_text text NOT NULL DEFAULT '© 2026 MetsXMFanZone — The Ultimate Mets Fan Community',
  button_border_radius text NOT NULL DEFAULT '10px',
  logo_width integer NOT NULL DEFAULT 85,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.email_template_settings (id) VALUES (1);

ALTER TABLE public.email_template_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON public.email_template_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update" ON public.email_template_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_template_settings_updated_at
  BEFORE UPDATE ON public.email_template_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();