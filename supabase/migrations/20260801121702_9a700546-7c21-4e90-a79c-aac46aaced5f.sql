DROP POLICY IF EXISTS "Anyone can view community images" ON storage.objects;

DROP POLICY IF EXISTS "Users can view community images" ON storage.objects;
CREATE POLICY "Users can view community images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'community_images');

DROP POLICY IF EXISTS "Users can update their own community images" ON storage.objects;
CREATE POLICY "Users can update their own community images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'community_images' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'community_images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated users can view all site settings" ON public.site_settings;