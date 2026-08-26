-- Feedback is read through normal database queries with column-level restrictions.
-- Remove it from realtime broadcasts because realtime payloads can include columns
-- that visitors are not allowed to read through the API.
ALTER PUBLICATION supabase_realtime DROP TABLE public.feedbacks;