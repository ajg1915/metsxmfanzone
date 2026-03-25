
-- Remove 'spring-training-live' and 'spring-training-games' from assigned_pages
UPDATE public.live_streams
SET assigned_pages = array_remove(array_remove(assigned_pages, 'spring-training-live'), 'spring-training-games')
WHERE 'spring-training-live' = ANY(assigned_pages) OR 'spring-training-games' = ANY(assigned_pages);

-- Ensure all streams with assigned_pages have 'metsxmfanzone' if missing
UPDATE public.live_streams
SET assigned_pages = array_append(assigned_pages, 'metsxmfanzone')
WHERE assigned_pages IS NOT NULL AND array_length(assigned_pages, 1) > 0 AND NOT ('metsxmfanzone' = ANY(assigned_pages));

-- Ensure all streams with assigned_pages have 'live' if missing
UPDATE public.live_streams
SET assigned_pages = array_append(assigned_pages, 'live')
WHERE assigned_pages IS NOT NULL AND array_length(assigned_pages, 1) > 0 AND NOT ('live' = ANY(assigned_pages));
