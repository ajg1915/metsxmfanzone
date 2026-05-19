
CREATE OR REPLACE FUNCTION public.search_members(q text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  is_admin boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    public.has_role(p.id, 'admin'::app_role) AS is_admin
  FROM public.profiles p
  WHERE
    -- caller must be signed in
    auth.uid() IS NOT NULL
    -- only paid members or admins are findable
    AND (
      public.has_active_subscription(p.id)
      OR public.has_role(p.id, 'admin'::app_role)
    )
    -- match query against full_name (case-insensitive). Empty q returns top results.
    AND (
      COALESCE(NULLIF(trim(q), ''), '') = ''
      OR p.full_name ILIKE '%' || trim(q) || '%'
    )
  ORDER BY
    -- prioritize exact prefix matches
    CASE WHEN p.full_name ILIKE trim(q) || '%' THEN 0 ELSE 1 END,
    p.full_name ASC NULLS LAST
  LIMIT 25;
$$;

REVOKE ALL ON FUNCTION public.search_members(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_members(text) TO authenticated;
