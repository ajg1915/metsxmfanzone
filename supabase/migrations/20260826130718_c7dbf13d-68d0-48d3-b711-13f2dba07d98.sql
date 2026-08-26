-- Harden email event ingestion: only backend service code may create delivery events.
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role insert" ON public.email_events;
DROP POLICY IF EXISTS "Service role can record email events" ON public.email_events;

REVOKE INSERT, UPDATE, DELETE ON public.email_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;

CREATE POLICY "Service role can record email events"
ON public.email_events
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- Harden temporary WebAuthn/passkey challenges: all challenge lifecycle operations
-- are performed by Edge Functions using the backend service identity.
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can create own challenges" ON public.webauthn_challenges;
DROP POLICY IF EXISTS "Users can read own challenges" ON public.webauthn_challenges;
DROP POLICY IF EXISTS "Users can delete own challenges" ON public.webauthn_challenges;
DROP POLICY IF EXISTS "Create challenges with valid data" ON public.webauthn_challenges;
DROP POLICY IF EXISTS "Service role manages webauthn challenges" ON public.webauthn_challenges;

REVOKE ALL ON public.webauthn_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.webauthn_challenges TO service_role;

CREATE POLICY "Service role manages webauthn challenges"
ON public.webauthn_challenges
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Keep gamecast archives publicly readable, but remove duplicate service-role policy
-- and revoke write privileges from visitor/member roles.
ALTER TABLE public.gamecast_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages gamecast archives" ON public.gamecast_archives;

REVOKE INSERT, UPDATE, DELETE ON public.gamecast_archives FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gamecast_archives TO anon, authenticated;
GRANT ALL ON public.gamecast_archives TO service_role;

-- Keep podcaster applications owner/admin scoped, but avoid public-role ownership policies.
ALTER TABLE public.podcaster_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own podcaster applications" ON public.podcaster_applications;

REVOKE ALL ON public.podcaster_applications FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcaster_applications TO authenticated;
GRANT ALL ON public.podcaster_applications TO service_role;

CREATE POLICY "Users can delete own podcaster applications"
ON public.podcaster_applications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);