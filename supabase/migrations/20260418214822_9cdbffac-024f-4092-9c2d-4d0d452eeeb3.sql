
-- Helper to check premium access (premium, annual, or admin)
CREATE OR REPLACE FUNCTION public.has_gameday_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_active_subscription(_user_id)
$$;

-- ============== POLLS ==============
CREATE TABLE public.gameday_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  poll_type TEXT NOT NULL DEFAULT 'poll', -- 'poll' or 'prediction'
  points INTEGER NOT NULL DEFAULT 10,
  correct_option_index INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gameday_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members can view polls"
ON public.gameday_polls FOR SELECT TO authenticated
USING (public.has_gameday_access(auth.uid()));

CREATE POLICY "Admins manage polls"
ON public.gameday_polls FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER gameday_polls_updated
BEFORE UPDATE ON public.gameday_polls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== POLL VOTES ==============
CREATE TABLE public.gameday_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.gameday_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
ALTER TABLE public.gameday_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members view votes"
ON public.gameday_poll_votes FOR SELECT TO authenticated
USING (public.has_gameday_access(auth.uid()));

CREATE POLICY "Members cast own vote"
ON public.gameday_poll_votes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_gameday_access(auth.uid()));

CREATE POLICY "Members delete own vote"
ON public.gameday_poll_votes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_gameday_poll_votes_poll ON public.gameday_poll_votes(poll_id);

-- ============== REACTIONS ==============
CREATE TABLE public.gameday_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gameday_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members view reactions"
ON public.gameday_reactions FOR SELECT TO authenticated
USING (public.has_gameday_access(auth.uid()));

CREATE POLICY "Members send own reactions"
ON public.gameday_reactions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_gameday_access(auth.uid()));

CREATE INDEX idx_gameday_reactions_created ON public.gameday_reactions(created_at DESC);

-- ============== LEADERBOARD ==============
CREATE TABLE public.gameday_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  total_predictions INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gameday_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members view leaderboard"
ON public.gameday_leaderboard FOR SELECT TO authenticated
USING (public.has_gameday_access(auth.uid()));

CREATE POLICY "Admins manage leaderboard"
ON public.gameday_leaderboard FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER gameday_leaderboard_updated
BEFORE UPDATE ON public.gameday_leaderboard
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== VOICE ROOMS ==============
CREATE TABLE public.gameday_voice_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  livekit_room_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_participants INTEGER NOT NULL DEFAULT 25,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gameday_voice_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members view rooms"
ON public.gameday_voice_rooms FOR SELECT TO authenticated
USING (public.has_gameday_access(auth.uid()));

CREATE POLICY "Admins manage rooms"
ON public.gameday_voice_rooms FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER gameday_voice_rooms_updated
BEFORE UPDATE ON public.gameday_voice_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== CHAT ==============
CREATE TABLE public.gameday_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 500 AND char_length(content) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gameday_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members view chat"
ON public.gameday_chat FOR SELECT TO authenticated
USING (public.has_gameday_access(auth.uid()));

CREATE POLICY "Members post chat"
ON public.gameday_chat FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_gameday_access(auth.uid()));

CREATE POLICY "Owners or admins delete chat"
ON public.gameday_chat FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_gameday_chat_created ON public.gameday_chat(created_at DESC);

-- ============== ANNOUNCEMENTS ==============
CREATE TABLE public.gameday_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gameday_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members view announcements"
ON public.gameday_announcements FOR SELECT TO authenticated
USING (public.has_gameday_access(auth.uid()));

CREATE POLICY "Admins manage announcements"
ON public.gameday_announcements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER gameday_announcements_updated
BEFORE UPDATE ON public.gameday_announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== REALTIME ==============
ALTER PUBLICATION supabase_realtime ADD TABLE public.gameday_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gameday_poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gameday_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gameday_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gameday_announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gameday_voice_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gameday_leaderboard;
