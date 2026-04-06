
-- Sweepstakes Events table
CREATE TABLE public.sweepstakes_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  max_spins_per_user INTEGER NOT NULL DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sweepstakes_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active events" ON public.sweepstakes_events
  FOR SELECT USING (is_active = true AND now() BETWEEN start_time AND end_time);

CREATE POLICY "Admins can manage events" ON public.sweepstakes_events
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Sweepstakes Prizes table
CREATE TABLE public.sweepstakes_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.sweepstakes_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prize_type TEXT NOT NULL DEFAULT 'exclusive_content',
  odds_weight INTEGER NOT NULL DEFAULT 1,
  icon TEXT DEFAULT '🎁',
  color TEXT DEFAULT '#FF5910',
  content_url TEXT,
  is_grand_prize BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sweepstakes_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view prizes for active events" ON public.sweepstakes_prizes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sweepstakes_events e
      WHERE e.id = event_id AND e.is_active = true AND now() BETWEEN e.start_time AND e.end_time
    )
  );

CREATE POLICY "Admins can manage prizes" ON public.sweepstakes_prizes
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Sweepstakes Winners table
CREATE TABLE public.sweepstakes_winners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.sweepstakes_events(id) ON DELETE CASCADE,
  prize_id UUID NOT NULL REFERENCES public.sweepstakes_prizes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  won_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.sweepstakes_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wins" ON public.sweepstakes_winners
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wins" ON public.sweepstakes_winners
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage winners" ON public.sweepstakes_winners
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_sweepstakes_events_active ON public.sweepstakes_events(is_active, start_time, end_time);
CREATE INDEX idx_sweepstakes_prizes_event ON public.sweepstakes_prizes(event_id);
CREATE INDEX idx_sweepstakes_winners_user ON public.sweepstakes_winners(user_id, event_id);
