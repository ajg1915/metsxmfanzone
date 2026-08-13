-- Public listing view without the sensitive stream_url
CREATE OR REPLACE VIEW public.live_streams_public AS
SELECT
  id, title, description, thumbnail_url, status, published,
  assigned_pages, display_order, viewers_count,
  scheduled_start, scheduled_end, actual_start, actual_end,
  created_at, updated_at
FROM public.live_streams
WHERE published = true;

GRANT SELECT ON public.live_streams_public TO anon, authenticated;
GRANT SELECT ON public.live_streams_public TO service_role;

-- Remove anon access to the base table (stream_url exposure)
DROP POLICY IF EXISTS "Public can view published live streams" ON public.live_streams;

-- Require an active membership/trial (or admin) for base-table reads
DROP POLICY IF EXISTS "Authenticated users can view published live streams" ON public.live_streams;

CREATE POLICY "Members can view published live streams"
ON public.live_streams
FOR SELECT
TO authenticated
USING (
  published = true
  AND (
    public.has_gameday_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND s.status = 'active'
        AND (s.end_date IS NULL OR s.end_date > now())
    )
  )
);