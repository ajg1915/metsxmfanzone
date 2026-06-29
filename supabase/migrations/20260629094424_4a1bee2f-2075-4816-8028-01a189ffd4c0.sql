CREATE POLICY "Public can view published live streams" ON public.live_streams FOR SELECT TO anon USING (published = true);
GRANT SELECT ON public.live_streams TO anon;