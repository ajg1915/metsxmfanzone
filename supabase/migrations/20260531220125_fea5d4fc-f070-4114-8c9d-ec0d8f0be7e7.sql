
-- chat_usage: remove blanket ALL policy; only owner/admin can write
DROP POLICY IF EXISTS "Authenticated Manage" ON public.chat_usage;
CREATE POLICY "Users insert own chat usage"
  ON public.chat_usage FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own chat usage"
  ON public.chat_usage FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage chat usage"
  ON public.chat_usage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- daily_player_predictions: restrict writes to admins, keep public read
DROP POLICY IF EXISTS "Authenticated Manage" ON public.daily_player_predictions;
CREATE POLICY "Admins manage daily player predictions"
  ON public.daily_player_predictions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- game_alerts: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated users can manage alerts" ON public.game_alerts;
CREATE POLICY "Admins manage game alerts"
  ON public.game_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- popup_notifications: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated Manage" ON public.popup_notifications;
CREATE POLICY "Admins manage popup notifications"
  ON public.popup_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- poll_votes: tighten SELECT so voters only see their own votes
DROP POLICY IF EXISTS "Users can view own votes" ON public.poll_votes;
CREATE POLICY "Users can view own votes"
  ON public.poll_votes FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- realtime_presence: only owner can update/delete their record
DROP POLICY IF EXISTS "Users can update own presence" ON public.realtime_presence;
DROP POLICY IF EXISTS "Users can delete own presence" ON public.realtime_presence;
CREATE POLICY "Users can update own presence"
  ON public.realtime_presence FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own presence"
  ON public.realtime_presence FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime channel subscription guard for premium gameday topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gameday topics require subscription" ON realtime.messages;
CREATE POLICY "Gameday topics require subscription"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    CASE
      WHEN COALESCE(realtime.topic(), '') LIKE 'gameday_%'
        THEN public.has_gameday_access(auth.uid())
      ELSE true
    END
  );

DROP POLICY IF EXISTS "Authenticated can broadcast non-gameday" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast non-gameday"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    CASE
      WHEN COALESCE(realtime.topic(), '') LIKE 'gameday_%'
        THEN public.has_gameday_access(auth.uid())
      ELSE true
    END
  );
