DROP VIEW IF EXISTS public.blogs;

CREATE VIEW public.blogs
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  title,
  slug,
  content,
  excerpt,
  featured_image_url,
  category,
  tags,
  published,
  published_at,
  created_at,
  updated_at,
  audio_url,
  approval_status,
  scheduled_publish_at,
  meta_description,
  is_draft
FROM public.blog_posts;

GRANT SELECT ON public.blogs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blogs TO authenticated;
GRANT ALL ON public.blogs TO service_role;