-- 1) live_streams_public: run as the querying user, with column-limited anon/member read of safe metadata
ALTER VIEW public.live_streams_public SET (security_invoker = on);

DROP POLICY IF EXISTS "Public can view published live stream metadata" ON public.live_streams;
CREATE POLICY "Public can view published live stream metadata"
ON public.live_streams
FOR SELECT
TO anon, authenticated
USING (published = true);

-- stream_url must never be readable through the metadata path: use column-level grants
REVOKE SELECT ON public.live_streams FROM anon;
GRANT SELECT (id, title, description, thumbnail_url, status, scheduled_start, scheduled_end,
              actual_start, actual_end, viewers_count, published, created_at, updated_at,
              assigned_pages, display_order)
  ON public.live_streams TO anon;
GRANT SELECT ON public.live_streams_public TO anon, authenticated;

-- 2) community_images: owner-scoped reads, plus files referenced by community posts/comments
DROP POLICY IF EXISTS "Users can view community images" ON storage.objects;
CREATE POLICY "Users can view own or post-linked community images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'community_images'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR (storage.foldername(name))[1] = 'comments'
       AND (auth.uid())::text = (storage.foldername(name))[2]
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.image_url = storage.objects.name)
    OR EXISTS (SELECT 1 FROM public.post_comments c WHERE c.media_url = storage.objects.name)
  )
);

-- 3) shop_orders: an order may only be attributed to the buyer, or to nobody (guest checkout)
DROP POLICY IF EXISTS "Anyone can create orders with valid data" ON public.shop_orders;
CREATE POLICY "Buyers can create their own orders"
ON public.shop_orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  product_id IS NOT NULL
  AND customer_name IS NOT NULL
  AND customer_email IS NOT NULL
  AND total_amount > 0
  AND (user_id IS NULL OR user_id = auth.uid())
);