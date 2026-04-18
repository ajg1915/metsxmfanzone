-- Create table to track TikTok Live status (single-row state)
CREATE TABLE IF NOT EXISTS public.tiktok_live_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_live BOOLEAN NOT NULL DEFAULT false,
  tiktok_username TEXT NOT NULL DEFAULT 'metsxmfanzone',
  stream_title TEXT,
  went_live_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single row
INSERT INTO public.tiktok_live_status (id, is_live, tiktok_username)
VALUES (1, false, 'metsxmfanzone')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tiktok_live_status ENABLE ROW LEVEL SECURITY;

-- Anyone (logged-in or not) can read the live status
CREATE POLICY "Public can view tiktok live status"
ON public.tiktok_live_status
FOR SELECT
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update tiktok live status"
ON public.tiktok_live_status
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime so banner updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.tiktok_live_status;
ALTER TABLE public.tiktok_live_status REPLICA IDENTITY FULL;