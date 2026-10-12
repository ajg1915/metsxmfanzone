-- Re-enable the welcome email on signup. Non-blocking (pg_net) and failure-safe.
CREATE OR REPLACE FUNCTION public.send_welcome_email_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://rdmrxeplasttewtlfetc.supabase.co/functions/v1/send-welcome-email',
      body := jsonb_build_object('record', jsonb_build_object('id', NEW.id)),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA'
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome email trigger failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
