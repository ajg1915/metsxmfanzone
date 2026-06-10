CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND plan_type IN ('weekly', 'premium', 'annual')
      AND (end_date IS NULL OR end_date > now())
  )
$function$;