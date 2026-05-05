
-- Game Recaps
CREATE TABLE public.game_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  opponent TEXT,
  game_date DATE,
  home_away TEXT,
  mets_score INTEGER,
  opponent_score INTEGER,
  result TEXT,
  summary TEXT,
  body TEXT,
  hero_image_url TEXT,
  highlights JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  author_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published recaps"
ON public.game_recaps FOR SELECT
USING (status = 'published');

CREATE POLICY "Admins manage all recaps"
ON public.game_recaps FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_game_recaps_updated_at
BEFORE UPDATE ON public.game_recaps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_game_recaps_status_date ON public.game_recaps(status, game_date DESC);

-- Podcast Outline Templates
CREATE TABLE public.podcast_outline_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  show_type TEXT,
  duration_minutes INTEGER,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  author_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_outline_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage outline templates"
ON public.podcast_outline_templates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_podcast_outline_templates_updated_at
BEFORE UPDATE ON public.podcast_outline_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
