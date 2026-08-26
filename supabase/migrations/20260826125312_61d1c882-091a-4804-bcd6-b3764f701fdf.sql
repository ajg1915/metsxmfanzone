-- 1. Pin search_path on the queue helpers (was mutable)
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- 2. Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions that
--    should only ever run from backend services or as trigger bodies.
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_presence() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_daily_predictions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_welcome_email_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_presence() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_daily_predictions() TO service_role;

-- anon never needs the per-user access helpers
REVOKE EXECUTE ON FUNCTION public.get_user_subscription_safe(uuid) FROM anon;

-- 3. Feedback: stop exposing submitter identity to anon/authenticated readers.
DROP POLICY IF EXISTS "Public can view feedbacks via view" ON public.feedbacks;

CREATE POLICY "Anyone can read public feedback columns"
ON public.feedbacks
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE SELECT ON public.feedbacks FROM anon, authenticated;
GRANT SELECT (id, content, rating, created_at, updated_at, location, display_name)
  ON public.feedbacks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;