
-- 1. live_streams: restrict to authenticated to hide stream_url from anonymous users
DROP POLICY IF EXISTS "Anyone can view published live streams" ON public.live_streams;
CREATE POLICY "Authenticated users can view published live streams"
  ON public.live_streams FOR SELECT
  TO authenticated
  USING (published = true);

-- 2. site_settings: add is_public flag, restrict anon to public-flagged keys
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
UPDATE public.site_settings SET is_public = true
  WHERE setting_key IN ('site_branding','maintenance_mode','feature_toggles','desktop_welcome_gate');
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view public site settings"
  ON public.site_settings FOR SELECT
  USING (is_public = true);
CREATE POLICY "Authenticated users can view all site settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3. activity_logs: enforce that user_id matches the inserter
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.activity_logs;
CREATE POLICY "Users can insert own logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can insert any log"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. live_notifications: restrict to active only for non-admins
DROP POLICY IF EXISTS "Anyone can view active notifications" ON public.live_notifications;
CREATE POLICY "Anyone can view active live notifications"
  ON public.live_notifications FOR SELECT
  USING (is_active = true);
CREATE POLICY "Admins can view all live notifications"
  ON public.live_notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. player_of_the_month_votes: hide voter user_ids; provide aggregate function
DROP POLICY IF EXISTS "Anyone can view votes" ON public.player_of_the_month_votes;
CREATE POLICY "Users can view own votes"
  ON public.player_of_the_month_votes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all votes"
  ON public.player_of_the_month_votes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_potm_vote_counts(p_player_of_the_month_id uuid)
RETURNS TABLE(vote_type text, vote_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vote_type, COUNT(*)::bigint
  FROM public.player_of_the_month_votes
  WHERE player_of_the_month_id = p_player_of_the_month_id
  GROUP BY vote_type;
$$;
GRANT EXECUTE ON FUNCTION public.get_potm_vote_counts(uuid) TO anon, authenticated;

-- 6. webauthn_challenges: tighten read/insert to prevent cross-user enumeration
DROP POLICY IF EXISTS "Users can read own or recent challenges" ON public.webauthn_challenges;
CREATE POLICY "Users can read own challenges"
  ON public.webauthn_challenges FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NOT NULL AND email = ((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text)
  );

DROP POLICY IF EXISTS "Create challenges with valid data" ON public.webauthn_challenges;
CREATE POLICY "Authenticated users can create own challenges"
  ON public.webauthn_challenges FOR INSERT
  TO authenticated
  WITH CHECK (
    challenge IS NOT NULL AND type IS NOT NULL
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- 7. oauth_csrf_tokens: server-side CSRF state for OAuth init/callback
CREATE TABLE IF NOT EXISTS public.oauth_csrf_tokens (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.oauth_csrf_tokens TO service_role;
ALTER TABLE public.oauth_csrf_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages oauth csrf"
  ON public.oauth_csrf_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
