CREATE TABLE public.chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat usage" ON public.chat_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated Manage" ON public.chat_usage FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_chat_usage_user_date ON public.chat_usage (user_id, created_at);