-- Contact form: keep visitor submissions allowed, but prevent authenticated users
-- from attaching a submission to another user's account.
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;

CREATE POLICY "Visitors can submit contact form"
ON public.contact_submissions
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Members can submit own contact form"
ON public.contact_submissions
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Poll votes: remove anonymous/session-only voting and raw public vote reads.
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anonymous users can vote with session" ON public.poll_votes;
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.poll_votes;
DROP POLICY IF EXISTS "Users can view own votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Admins can view all votes" ON public.poll_votes;

CREATE POLICY "Members can vote once as themselves"
ON public.poll_votes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can view own poll votes"
ON public.poll_votes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view poll votes"
ON public.poll_votes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete own votes" ON public.poll_votes;
CREATE POLICY "Members can delete own poll votes"
ON public.poll_votes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Keep UI vote totals working without exposing individual vote rows.
CREATE OR REPLACE FUNCTION public.get_poll_vote_counts(p_poll_id uuid)
RETURNS TABLE(option_index integer, vote_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pv.option_index, count(*)::bigint AS vote_count
  FROM public.poll_votes pv
  WHERE pv.poll_id = p_poll_id
  GROUP BY pv.option_index
  ORDER BY pv.option_index;
$$;

REVOKE ALL ON FUNCTION public.get_poll_vote_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_poll_vote_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_vote_counts(uuid) TO service_role;