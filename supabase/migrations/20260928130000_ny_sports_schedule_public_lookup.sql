-- Upcoming NY team games for the home page "NY Sports Teams Events" section.
-- Returns schedule details only (never stream_url), including games not yet
-- published, so fans can see what's coming before a link is added.
create or replace function public.get_ny_sports_schedule(p_limit integer default 24)
returns table (
  id uuid,
  title text,
  description text,
  thumbnail_url text,
  status text,
  scheduled_start timestamptz,
  assigned_pages text[],
  published boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select ls.id, ls.title, ls.description, ls.thumbnail_url, ls.status::text,
         ls.scheduled_start, ls.assigned_pages, coalesce(ls.published, false)
  from public.live_streams ls
  where ls.status in ('live', 'scheduled')
    and ls.assigned_pages && array['ny-jets','ny-giants','ny-knicks','ny-rangers','ny-islanders','brooklyn-nets']
    and (ls.status = 'live' or ls.scheduled_start is null or ls.scheduled_start >= now() - interval '4 hours')
  order by (ls.status = 'live') desc, ls.scheduled_start asc nulls last
  limit least(greatest(coalesce(p_limit, 24), 1), 50);
$$;

revoke all on function public.get_ny_sports_schedule(integer) from public;
grant execute on function public.get_ny_sports_schedule(integer) to anon, authenticated;
