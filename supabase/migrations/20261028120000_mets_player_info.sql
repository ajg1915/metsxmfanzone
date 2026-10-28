create table if not exists public.mets_player_info (
  player_id integer primary key,
  player_name text not null,
  contract_years text,
  contract_total text,
  contract_aav text,
  contract_through text,
  contract_notes text,
  watch_note text,
  updated_at timestamptz not null default now()
);
alter table public.mets_player_info enable row level security;
create policy "Anyone can view player info" on public.mets_player_info for select using (true);
create policy "Admins manage player info" on public.mets_player_info for all
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
