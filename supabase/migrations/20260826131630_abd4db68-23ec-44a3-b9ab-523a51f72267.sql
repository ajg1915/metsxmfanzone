CREATE TABLE IF NOT EXISTS public.poll_vote_counts (
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  vote_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, option_index)
);

GRANT SELECT ON public.poll_vote_counts TO authenticated;
GRANT ALL ON public.poll_vote_counts TO service_role;

ALTER TABLE public.poll_vote_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view poll vote counts" ON public.poll_vote_counts;
CREATE POLICY "Members can view poll vote counts"
ON public.poll_vote_counts
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.poll_vote_counts (poll_id, option_index, vote_count, updated_at)
SELECT poll_id, option_index, count(*)::bigint, now()
FROM public.poll_votes
GROUP BY poll_id, option_index
ON CONFLICT (poll_id, option_index)
DO UPDATE SET vote_count = EXCLUDED.vote_count, updated_at = now();

CREATE OR REPLACE FUNCTION public.refresh_poll_vote_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_poll_id uuid;
  affected_option_index integer;
BEGIN
  affected_poll_id := COALESCE(NEW.poll_id, OLD.poll_id);
  affected_option_index := COALESCE(NEW.option_index, OLD.option_index);

  INSERT INTO public.poll_vote_counts (poll_id, option_index, vote_count, updated_at)
  SELECT affected_poll_id, affected_option_index, count(*)::bigint, now()
  FROM public.poll_votes
  WHERE poll_id = affected_poll_id
    AND option_index = affected_option_index
  ON CONFLICT (poll_id, option_index)
  DO UPDATE SET vote_count = EXCLUDED.vote_count, updated_at = now();

  DELETE FROM public.poll_vote_counts
  WHERE poll_id = affected_poll_id
    AND option_index = affected_option_index
    AND vote_count = 0;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refresh_poll_vote_counts_trigger ON public.poll_votes;
CREATE TRIGGER refresh_poll_vote_counts_trigger
AFTER INSERT OR DELETE OR UPDATE OF poll_id, option_index ON public.poll_votes
FOR EACH ROW
EXECUTE FUNCTION public.refresh_poll_vote_counts();

REVOKE ALL ON FUNCTION public.refresh_poll_vote_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_poll_vote_counts() TO service_role;

DROP FUNCTION IF EXISTS public.get_poll_vote_counts(uuid);