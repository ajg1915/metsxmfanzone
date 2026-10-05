-- One cheap call for the Cloudflare scheduler worker (mxf-scheduler):
-- tells it whether any scheduled work is due, so it only wakes the
-- Supabase functions when there is something to do.
create or replace function public.scheduler_flags()
returns jsonb
language sql
stable
security definer
set search_path = public, pgmq
as $$
  select jsonb_build_object(
    -- auto-stream-status: scheduled events whose start time has passed (last 12h)
    'streams_due', exists (
      select 1 from live_streams
       where status = 'scheduled' and published
         and scheduled_start <= now() and scheduled_start >= now() - interval '12 hours'),
    -- auto-stream-status: live events whose end time has passed
    'streams_to_end', exists (
      select 1 from live_streams
       where status = 'live' and scheduled_end is not null and scheduled_end <= now()),
    -- auto-stream-status: NY Sports event live but not emailed yet (and the switch is on)
    'ny_email_pending', coalesce((select enabled from gameday_email_settings where trigger_type = 'ny_sports_live'), true)
      and exists (
      select 1 from live_streams
       where status = 'live' and published and live_email_sent_at is null
         and assigned_pages && array['ny-giants','ny-jets','ny-knicks','brooklyn-nets','ny-rangers','ny-islanders']
         and coalesce(actual_start, scheduled_start, created_at) >= now() - interval '6 hours'),
    -- process-email-queue: emails waiting in the pgmq queue
    'email_queue', (select count(*) from pgmq.q_transactional_emails where vt <= now())
  );
$$;

revoke all on function public.scheduler_flags() from public, anon, authenticated;
grant execute on function public.scheduler_flags() to service_role;
