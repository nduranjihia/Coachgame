-- TABLES ---------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  settings jsonb not null default '{"lastCardPenalty":true,"sound":true,"moveHints":true}',
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  auth_uid uuid not null,
  kind text not null check (kind in ('tv','phone')),
  created_at timestamptz not null default now(),
  unique (household_id, auth_uid)
);
create index devices_auth_uid_idx on public.devices (auth_uid);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  auth_uid uuid,
  name text not null check (char_length(name) between 1 and 20),
  emoji text not null default '🦊',
  color text not null default 'coral' check (color in ('coral','sun','mint','sky','grape','rose')),
  created_at timestamptz not null default now()
);
create index players_household_idx on public.players (household_id);
create index players_auth_uid_idx on public.players (auth_uid);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  game text not null check (game in ('tictactoe','chess','cards')),
  status text not null default 'active' check (status in ('active','finished','abandoned')),
  seats uuid[] not null,
  state jsonb not null,
  version int not null default 0,
  winner_id uuid,
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index matches_household_idx on public.matches (household_id, created_at desc);
create unique index one_active_match_per_household on public.matches (household_id) where status = 'active';

create table public.hands (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  cards jsonb not null default '[]',
  primary key (match_id, player_id)
);
create index hands_household_idx on public.hands (household_id);

create table public.match_secrets (
  match_id uuid primary key references public.matches(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  data jsonb not null default '{}'
);

create table public.commands (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  player_id uuid not null,
  match_id uuid references public.matches(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reason text,
  created_at timestamptz not null default now()
);
create index commands_household_idx on public.commands (household_id, id);

-- HELPERS --------------------------------------------------------------
create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.devices d where d.household_id = h and d.auth_uid = auth.uid());
$$;

create or replace function public.is_tv(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.devices d where d.household_id = h and d.auth_uid = auth.uid() and d.kind = 'tv');
$$;

create or replace function public.gen_join_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text; i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * 31)::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where join_code = code);
  end loop;
  return code;
end $$;

-- ROW LEVEL SECURITY ---------------------------------------------------
alter table public.households enable row level security;
alter table public.devices enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.hands enable row level security;
alter table public.match_secrets enable row level security;
alter table public.commands enable row level security;

create policy "members read household" on public.households for select to authenticated using (public.is_member(id));
create policy "members read devices" on public.devices for select to authenticated using (public.is_member(household_id));
create policy "members read players" on public.players for select to authenticated using (public.is_member(household_id));
create policy "own player update" on public.players for update to authenticated
  using (auth_uid = auth.uid()) with check (auth_uid = auth.uid());
create policy "members read matches" on public.matches for select to authenticated using (public.is_member(household_id));
create policy "own hand or tv reads hands" on public.hands for select to authenticated using (
  public.is_tv(household_id)
  or exists (select 1 from public.players p where p.id = hands.player_id and p.auth_uid = auth.uid())
);
create policy "tv reads secrets" on public.match_secrets for select to authenticated using (public.is_tv(household_id));
create policy "members read commands" on public.commands for select to authenticated using (public.is_member(household_id));
create policy "players send commands" on public.commands for insert to authenticated with check (
  status = 'pending' and reason is null and exists (
    select 1 from public.players p
    where p.id = commands.player_id and p.household_id = commands.household_id and p.auth_uid = auth.uid()
  )
);

-- players may only edit their own cosmetic fields
revoke update on public.players from authenticated;
grant update (name, emoji, color) on public.players to authenticated;

-- RPC FUNCTIONS (all writes except commands and own profile go through these) --
create or replace function public.create_tv_household() returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into households (join_code) values (public.gen_join_code()) returning * into h;
  insert into devices (household_id, auth_uid, kind) values (h.id, auth.uid(), 'tv');
  return h;
end $$;

create or replace function public.preview_household(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into h from households where join_code = upper(trim(p_code));
  if not found then raise exception 'invalid_code'; end if;
  return jsonb_build_object(
    'household_id', h.id,
    'has_players', exists (select 1 from players p where p.household_id = h.id),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'emoji', p.emoji, 'color', p.color) order by p.created_at)
                         from players p where p.household_id = h.id), '[]'::jsonb)
  );
end $$;

create or replace function public.join_household(p_code text, p_name text, p_emoji text, p_color text) returns public.players
language plpgsql security definer set search_path = public as $$
declare h public.households; pl public.players; n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into h from households where join_code = upper(trim(p_code));
  if not found then raise exception 'invalid_code'; end if;
  if exists (select 1 from players where household_id = h.id and auth_uid = auth.uid()) then raise exception 'already_joined'; end if;
  select count(*) into n from players where household_id = h.id;
  if n >= 4 then raise exception 'household_full'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 20 then raise exception 'bad_name'; end if;
  insert into devices (household_id, auth_uid, kind) values (h.id, auth.uid(), 'phone') on conflict (household_id, auth_uid) do nothing;
  insert into players (household_id, auth_uid, name, emoji, color)
    values (h.id, auth.uid(), trim(p_name), coalesce(p_emoji,'🦊'), coalesce(p_color,'coral')) returning * into pl;
  return pl;
end $$;

create or replace function public.claim_player(p_code text, p_player_id uuid) returns public.players
language plpgsql security definer set search_path = public as $$
declare h public.households; pl public.players;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into h from households where join_code = upper(trim(p_code));
  if not found then raise exception 'invalid_code'; end if;
  select * into pl from players where id = p_player_id and household_id = h.id;
  if not found then raise exception 'invalid_player'; end if;
  insert into devices (household_id, auth_uid, kind) values (h.id, auth.uid(), 'phone') on conflict (household_id, auth_uid) do nothing;
  update players set auth_uid = null where household_id = h.id and auth_uid = auth.uid() and id <> pl.id;
  update players set auth_uid = auth.uid() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.link_tv(p_source uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_target) then raise exception 'forbidden'; end if;
  if p_source = p_target then return; end if;
  if exists (select 1 from players where household_id = p_source) then raise exception 'source_not_empty'; end if;
  if exists (select 1 from devices where household_id = p_source and kind <> 'tv') then raise exception 'source_not_empty'; end if;
  update devices set household_id = p_target where household_id = p_source and kind = 'tv';
  delete from households where id = p_source;
end $$;

create or replace function public.update_settings(p_household uuid, p_settings jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_household) then raise exception 'forbidden'; end if;
  update households set settings = settings || p_settings where id = p_household;
end $$;

create or replace function public.remove_player(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  select household_id into h from players where id = p_player;
  if h is null then return; end if;
  if not public.is_member(h) then raise exception 'forbidden'; end if;
  delete from players where id = p_player;
end $$;

create or replace function public.clear_history(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_household) then raise exception 'forbidden'; end if;
  delete from matches where household_id = p_household;
  delete from commands where household_id = p_household;
end $$;

create or replace function public.delete_household(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_household) then raise exception 'forbidden'; end if;
  delete from households where id = p_household;
end $$;

create or replace function public.create_match(
  p_household uuid, p_game text, p_seats uuid[], p_state jsonb, p_hands jsonb, p_secrets jsonb, p_command_id bigint
) returns public.matches
language plpgsql security definer set search_path = public as $$
declare m public.matches; k text;
begin
  if not public.is_tv(p_household) then raise exception 'forbidden'; end if;
  update matches set status = 'abandoned', updated_at = now(), finished_at = now()
    where household_id = p_household and status = 'active';
  insert into matches (household_id, game, seats, state) values (p_household, p_game, p_seats, p_state) returning * into m;
  if p_hands is not null then
    for k in select jsonb_object_keys(p_hands) loop
      insert into hands (match_id, player_id, household_id, cards) values (m.id, k::uuid, p_household, p_hands -> k);
    end loop;
  end if;
  if p_secrets is not null then
    insert into match_secrets (match_id, household_id, data) values (m.id, p_household, p_secrets);
  end if;
  if p_command_id is not null then
    update commands set status = 'accepted', reason = null where id = p_command_id and household_id = p_household;
  end if;
  delete from commands where household_id = p_household and created_at < now() - interval '2 days';
  return m;
end $$;

create or replace function public.commit_turn(
  p_match uuid, p_expected_version int, p_state jsonb, p_status text, p_winner uuid, p_result text,
  p_hands jsonb, p_secrets jsonb, p_command_id bigint
) returns int
language plpgsql security definer set search_path = public as $$
declare m public.matches; k text;
begin
  select * into m from matches where id = p_match for update;
  if not found then raise exception 'no_match'; end if;
  if not public.is_tv(m.household_id) then raise exception 'forbidden'; end if;
  if m.status <> 'active' then raise exception 'match_over'; end if;
  if m.version <> p_expected_version then raise exception 'version_conflict'; end if;
  if p_status not in ('active','finished','abandoned') then raise exception 'bad_status'; end if;
  update matches set state = p_state, version = version + 1, status = p_status, winner_id = p_winner,
    result = p_result, updated_at = now(),
    finished_at = case when p_status in ('finished','abandoned') then now() else null end
  where id = p_match;
  if p_hands is not null then
    for k in select jsonb_object_keys(p_hands) loop
      insert into hands (match_id, player_id, household_id, cards) values (p_match, k::uuid, m.household_id, p_hands -> k)
      on conflict (match_id, player_id) do update set cards = excluded.cards;
    end loop;
  end if;
  if p_secrets is not null then
    insert into match_secrets (match_id, household_id, data) values (p_match, m.household_id, p_secrets)
      on conflict (match_id) do update set data = excluded.data;
  end if;
  if p_command_id is not null then
    update commands set status = 'accepted', reason = null where id = p_command_id;
  end if;
  return m.version + 1;
end $$;

create or replace function public.resolve_command(p_id bigint, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.commands;
begin
  select * into c from commands where id = p_id;
  if not found then return; end if;
  if not public.is_tv(c.household_id) then raise exception 'forbidden'; end if;
  if p_status not in ('accepted','rejected') then raise exception 'bad_status'; end if;
  update commands set status = p_status, reason = p_reason where id = p_id and status = 'pending';
end $$;

-- FUNCTION PERMISSIONS ---------------------------------------------------
revoke all on function public.gen_join_code() from public, anon, authenticated;
revoke all on function public.create_tv_household() from public, anon;
revoke all on function public.preview_household(text) from public, anon;
revoke all on function public.join_household(text,text,text,text) from public, anon;
revoke all on function public.claim_player(text,uuid) from public, anon;
revoke all on function public.link_tv(uuid,uuid) from public, anon;
revoke all on function public.update_settings(uuid,jsonb) from public, anon;
revoke all on function public.remove_player(uuid) from public, anon;
revoke all on function public.clear_history(uuid) from public, anon;
revoke all on function public.delete_household(uuid) from public, anon;
revoke all on function public.create_match(uuid,text,uuid[],jsonb,jsonb,jsonb,bigint) from public, anon;
revoke all on function public.commit_turn(uuid,int,jsonb,text,uuid,text,jsonb,jsonb,bigint) from public, anon;
revoke all on function public.resolve_command(bigint,text,text) from public, anon;
grant execute on function public.create_tv_household() to authenticated;
grant execute on function public.preview_household(text) to authenticated;
grant execute on function public.join_household(text,text,text,text) to authenticated;
grant execute on function public.claim_player(text,uuid) to authenticated;
grant execute on function public.link_tv(uuid,uuid) to authenticated;
grant execute on function public.update_settings(uuid,jsonb) to authenticated;
grant execute on function public.remove_player(uuid) to authenticated;
grant execute on function public.clear_history(uuid) to authenticated;
grant execute on function public.delete_household(uuid) to authenticated;
grant execute on function public.create_match(uuid,text,uuid[],jsonb,jsonb,jsonb,bigint) to authenticated;
grant execute on function public.commit_turn(uuid,int,jsonb,text,uuid,text,jsonb,jsonb,bigint) to authenticated;
grant execute on function public.resolve_command(bigint,text,text) to authenticated;

-- REALTIME ---------------------------------------------------------------
alter publication supabase_realtime add table public.households, public.devices, public.players,
  public.matches, public.hands, public.commands;
