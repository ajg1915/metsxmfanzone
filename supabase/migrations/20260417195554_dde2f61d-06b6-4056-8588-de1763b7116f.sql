CREATE TABLE public.live_stream_chat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_stream_chat_stream_created ON public.live_stream_chat(stream_id, created_at DESC);

ALTER TABLE public.live_stream_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat messages"
  ON public.live_stream_chat FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can post messages"
  ON public.live_stream_chat FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON public.live_stream_chat FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any message"
  ON public.live_stream_chat FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_chat;
ALTER TABLE public.live_stream_chat REPLICA IDENTITY FULL;