
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published blogs"
ON public.blogs FOR SELECT
USING (is_published = true);

CREATE POLICY "Authors can view own blogs"
ON public.blogs FOR SELECT
TO authenticated
USING (auth.uid() = author_id);

CREATE POLICY "Authors can insert own blogs"
ON public.blogs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own blogs"
ON public.blogs FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete own blogs"
ON public.blogs FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

CREATE POLICY "Admins manage all blogs"
ON public.blogs FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
