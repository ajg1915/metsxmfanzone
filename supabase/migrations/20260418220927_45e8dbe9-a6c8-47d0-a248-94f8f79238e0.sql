-- Add approval workflow columns to voice rooms
ALTER TABLE public.gameday_voice_rooms
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Backfill existing rows as approved
UPDATE public.gameday_voice_rooms SET status = 'approved' WHERE status IS NULL;

-- Drop old broad policies and rebuild
DROP POLICY IF EXISTS "Public Read Access" ON public.gameday_voice_rooms;
DROP POLICY IF EXISTS "Authenticated Manage" ON public.gameday_voice_rooms;
DROP POLICY IF EXISTS "Anyone can view active voice rooms" ON public.gameday_voice_rooms;
DROP POLICY IF EXISTS "Admins manage voice rooms" ON public.gameday_voice_rooms;
DROP POLICY IF EXISTS "Members create pending rooms" ON public.gameday_voice_rooms;
DROP POLICY IF EXISTS "Members view own pending rooms" ON public.gameday_voice_rooms;

ALTER TABLE public.gameday_voice_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved voice rooms"
ON public.gameday_voice_rooms FOR SELECT
USING (status = 'approved' AND is_active = true);

CREATE POLICY "Members view own pending rooms"
ON public.gameday_voice_rooms FOR SELECT
TO authenticated
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Admins view all rooms"
ON public.gameday_voice_rooms FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members create pending rooms"
ON public.gameday_voice_rooms FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by_user_id
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (status = 'pending' AND public.has_active_subscription(auth.uid()))
  )
);

CREATE POLICY "Admins update rooms"
ON public.gameday_voice_rooms FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete rooms"
ON public.gameday_voice_rooms FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- New table: scheduled radio/podcast live shows
CREATE TABLE IF NOT EXISTS public.radio_scheduled_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  host_name text NOT NULL,
  description text,
  cover_image_url text,
  scheduled_start timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  stream_url text,
  is_live boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.radio_scheduled_shows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published shows" ON public.radio_scheduled_shows;
DROP POLICY IF EXISTS "Admins manage scheduled shows" ON public.radio_scheduled_shows;

CREATE POLICY "Anyone can view published shows"
ON public.radio_scheduled_shows FOR SELECT
USING (published = true);

CREATE POLICY "Admins manage scheduled shows"
ON public.radio_scheduled_shows FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_radio_scheduled_shows_updated_at
BEFORE UPDATE ON public.radio_scheduled_shows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_radio_scheduled_shows_start ON public.radio_scheduled_shows(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_voice_rooms_status ON public.gameday_voice_rooms(status);