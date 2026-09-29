-- 002: make a losing `create_match` say so ----------------------------------
--
-- `create_match` abandoned any active match and inserted a new one
-- unconditionally. `start_match` had no check for a running match, so the first
-- player to tap "Let's go" had their game silently ended by the second tap, with
-- their command marked `accepted` and no message to anyone.
--
-- The fix for that is not here. It is `admitStartMatch` in `useCommandProcessor`,
-- which refuses the second command before any SQL runs, and the confirm sheet in
-- `StartSheet` that makes ending a game a two-press action. This migration does
-- not add a constraint either: `one_active_match_per_household` has existed
-- since 001, and it cannot catch this case anyway, because the TV processes
-- pending commands one at a time and so never inserts two active matches in the
-- same instant. (002 briefly created a duplicate index; 003 drops it.)
--
-- What is left for the database to do is report the violation sensibly when two
-- TV sessions on one home really do collide, so the phone that lost hears
-- "Someone else already started a game" rather than a raw constraint error.
-- Raising here rolls the whole RPC back, which also undoes the abandon, so the
-- running match is left exactly as it was.
create or replace function public.create_match(
  p_household uuid, p_game text, p_seats uuid[], p_state jsonb, p_hands jsonb, p_secrets jsonb, p_command_id bigint
) returns public.matches
language plpgsql security definer set search_path = public as $$
declare m public.matches; k text;
begin
  if not public.is_tv(p_household) then raise exception 'forbidden'; end if;
  update matches set status = 'abandoned', updated_at = now(), finished_at = now()
    where household_id = p_household and status = 'active';
  begin
    insert into matches (household_id, game, seats, state)
    values (p_household, p_game, p_seats, p_state) returning * into m;
  exception when unique_violation then
    raise exception 'match_in_progress';
  end;
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
