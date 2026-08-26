GRANT SELECT (
  id, title, description, thumbnail_url, status, scheduled_start, scheduled_end,
  actual_start, actual_end, viewers_count, published, created_at, updated_at,
  assigned_pages, display_order
) ON public.live_streams TO anon;

GRANT SELECT ON public.live_streams_public TO anon, authenticated;