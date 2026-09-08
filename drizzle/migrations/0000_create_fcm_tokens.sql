CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_idx ON public.fcm_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can view own fcm tokens" ON public.fcm_tokens
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can insert own fcm tokens" ON public.fcm_tokens
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can update own fcm tokens" ON public.fcm_tokens
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can delete own fcm tokens" ON public.fcm_tokens
FOR DELETE TO authenticated USING (auth.uid() = user_id);