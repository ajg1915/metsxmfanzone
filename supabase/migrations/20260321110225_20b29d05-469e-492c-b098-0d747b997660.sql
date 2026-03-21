
CREATE TABLE public.popup_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  button_text TEXT DEFAULT 'Learn More',
  button_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  show_once_per_session BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.popup_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON public.popup_notifications FOR SELECT USING (true);
CREATE POLICY "Authenticated Manage" ON public.popup_notifications FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);
