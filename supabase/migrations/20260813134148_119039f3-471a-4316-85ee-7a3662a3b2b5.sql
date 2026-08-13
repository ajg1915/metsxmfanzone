
ALTER TABLE public.realtime_presence
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS entry_page text,
  ADD COLUMN IF NOT EXISTS stream_title text,
  ADD COLUMN IF NOT EXISTS referrer_url text;

-- allow anonymous visitors to keep their own (recent) presence row fresh
DROP POLICY IF EXISTS "Users can update own presence" ON public.realtime_presence;
CREATE POLICY "Visitors can refresh recent presence"
ON public.realtime_presence
FOR UPDATE
TO anon, authenticated
USING (last_seen_at > now() - interval '1 hour')
WITH CHECK (session_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own presence" ON public.realtime_presence;
CREATE POLICY "Visitors can delete recent presence"
ON public.realtime_presence
FOR DELETE
TO anon, authenticated
USING (last_seen_at > now() - interval '1 hour');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.realtime_presence TO anon, authenticated;
GRANT ALL ON public.realtime_presence TO service_role;

CREATE TABLE IF NOT EXISTS public.visitor_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid,
  page_path text NOT NULL,
  element_label text,
  element_href text,
  element_type text,
  country text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.visitor_clicks TO anon, authenticated;
GRANT SELECT ON public.visitor_clicks TO authenticated;
GRANT ALL ON public.visitor_clicks TO service_role;

ALTER TABLE public.visitor_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record clicks" ON public.visitor_clicks;
CREATE POLICY "Anyone can record clicks"
ON public.visitor_clicks
FOR INSERT
TO anon, authenticated
WITH CHECK (session_id IS NOT NULL);

DROP POLICY IF EXISTS "Admins can view clicks" ON public.visitor_clicks;
CREATE POLICY "Admins can view clicks"
ON public.visitor_clicks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS visitor_clicks_created_at_idx ON public.visitor_clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS realtime_presence_last_seen_idx ON public.realtime_presence (last_seen_at DESC);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_presence;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_clicks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
