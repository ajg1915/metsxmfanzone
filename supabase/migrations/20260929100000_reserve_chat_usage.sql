-- Atomic daily quota for the fan-chat AI: checks and reserves one chat_usage
-- row in a single transaction so parallel requests can't all slip past the
-- limit. Advisory locks serialize per fan (member or visitor) and per IP.
-- Returns true when the reply is allowed (and the usage row was inserted).
create or replace function public.reserve_chat_usage(
  p_user_id uuid,
  p_visitor_id text,
  p_ip_hash text,
  p_since timestamptz,
  p_limit integer,
  p_ip_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  if p_user_id is null and p_visitor_id is null then
    return false;
  end if;

  -- Always subject first, then IP, so two requests can't deadlock
  perform pg_advisory_xact_lock(hashtext('chat_usage:' || coalesce(p_user_id::text, 'v:' || p_visitor_id)));
  if p_user_id is null and p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtext('chat_usage_ip:' || p_ip_hash));
  end if;

  if p_user_id is not null then
    select count(*) into used from chat_usage where user_id = p_user_id and created_at >= p_since;
  else
    select count(*) into used from chat_usage where visitor_id = p_visitor_id and created_at >= p_since;
  end if;
  if used >= p_limit then
    return false;
  end if;

  -- Visitors also share a per-IP cap (stops rotating visitor ids)
  if p_user_id is null and p_ip_hash is not null then
    select count(*) into used from chat_usage where ip_hash = p_ip_hash and created_at >= p_since;
    if used >= p_ip_limit then
      return false;
    end if;
  end if;

  insert into chat_usage (user_id, visitor_id, ip_hash)
  values (p_user_id, case when p_user_id is null then p_visitor_id end, p_ip_hash);
  return true;
end;
$$;

revoke all on function public.reserve_chat_usage(uuid, text, text, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_chat_usage(uuid, text, text, timestamptz, integer, integer) to service_role;
