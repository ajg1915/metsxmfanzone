CREATE TABLE IF NOT EXISTS public.stream_source_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  label text NOT NULL,
  url text NOT NULL,
  is_up boolean NOT NULL DEFAULT true,
  status_code integer,
  last_error text,
  last_ok_at timestamptz,
  last_down_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stream_source_status TO authenticated;
GRANT ALL ON public.stream_source_status TO service_role;

ALTER TABLE public.stream_source_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view stream source status" ON public.stream_source_status;
CREATE POLICY "Admins can view stream source status"
ON public.stream_source_status
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS stream_source_status_updated_at ON public.stream_source_status;
CREATE TRIGGER stream_source_status_updated_at
BEFORE UPDATE ON public.stream_source_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_source_status;