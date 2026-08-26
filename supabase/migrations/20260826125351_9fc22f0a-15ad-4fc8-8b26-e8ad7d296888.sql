REVOKE EXECUTE ON FUNCTION public.cleanup_stale_presence() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_daily_predictions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_welcome_email_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_subscription_safe(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_presence() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_daily_predictions() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_safe(uuid) TO authenticated, service_role;