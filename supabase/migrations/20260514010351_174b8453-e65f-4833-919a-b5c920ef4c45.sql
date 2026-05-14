CREATE TABLE IF NOT EXISTS public.gamecast_archives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_pk BIGINT NOT NULL UNIQUE,
  game_date DATE NOT NULL,
  opponent TEXT NOT NULL,
  home_away TEXT NOT NULL CHECK (home_away IN ('home','away')),
  mets_score INTEGER,
  opponent_score INTEGER,
  result TEXT CHECK (result IN ('W','L','T')),
  venue TEXT,
  winning_pitcher TEXT,
  losing_pitcher TEXT,
  save_pitcher TEXT,
  status TEXT,
  plays JSONB NOT NULL DEFAULT '[]'::jsonb,
  linescore JSONB,
  boxscore JSONB,
  decisions JSONB,
  recap_generated BOOLEAN NOT NULL DEFAULT false,
  recap_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamecast_archives_date ON public.gamecast_archives(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_gamecast_archives_recap_pending ON public.gamecast_archives(recap_generated) WHERE recap_generated = false;

ALTER TABLE public.gamecast_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read gamecast archives" ON public.gamecast_archives;
CREATE POLICY "Public can read gamecast archives"
  ON public.gamecast_archives FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages gamecast archives" ON public.gamecast_archives;
CREATE POLICY "Service role manages gamecast archives"
  ON public.gamecast_archives FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_gamecast_archives_updated_at
BEFORE UPDATE ON public.gamecast_archives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();