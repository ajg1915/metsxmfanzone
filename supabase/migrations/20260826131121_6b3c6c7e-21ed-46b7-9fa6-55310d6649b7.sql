-- Blog posts: remove broad owner policy that let any signed-in user publish content.
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Writers can manage own posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Anyone can view published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Public can read published blog posts" ON public.blog_posts;

-- Keep one public read rule that requires moderation approval.
DROP POLICY IF EXISTS "Public can view approved posts" ON public.blog_posts;
CREATE POLICY "Public can view approved posts"
ON public.blog_posts
FOR SELECT
TO anon, authenticated
USING (
  published = true
  AND approval_status = 'approved'
);

-- Owners can still view drafts only if they are approved writers; admins can view all.
DROP POLICY IF EXISTS "Writers can view own posts" ON public.blog_posts;
CREATE POLICY "Writers can view own posts"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id AND public.is_writer(auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Business ads: non-admin owners may edit their ad content, but cannot self-approve
-- or alter moderation fields. New non-admin ads are always pending.
CREATE OR REPLACE FUNCTION public.enforce_business_ads_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.approved_by := NULL;
    NEW.published_at := NULL;
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.approved_by := OLD.approved_by;
  NEW.published_at := OLD.published_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_business_ads_moderation_trigger ON public.business_ads;
CREATE TRIGGER enforce_business_ads_moderation_trigger
BEFORE INSERT OR UPDATE ON public.business_ads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_ads_moderation();

REVOKE EXECUTE ON FUNCTION public.enforce_business_ads_moderation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_business_ads_moderation() TO service_role;