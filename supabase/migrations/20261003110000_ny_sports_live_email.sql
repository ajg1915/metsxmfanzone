-- NY Sports "LIVE NOW" emails (auto-stream-status sends them).
-- live_email_sent_at marks an event as already emailed so it's only sent once.
alter table public.live_streams
  add column if not exists live_email_sent_at timestamptz;

-- Anything already live or in the past counts as handled, so turning this on
-- never emails old or in-progress events.
update public.live_streams
   set live_email_sent_at = now()
 where live_email_sent_at is null
   and (status in ('live', 'ended') or coalesce(scheduled_start, created_at) < now());

-- Admin on/off switch (Game Notifications page). Starts OFF until approved.
insert into public.gameday_email_settings (trigger_type, enabled)
values ('ny_sports_live', false)
on conflict (trigger_type) do nothing;
