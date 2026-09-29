# COUCH CLASH — complete build spec

**Instructions to the AI builder (read first)**

1. Read this entire file before writing any code. Build exactly what it says.
2. Do not ask the user questions. Do not rename tables, columns, routes, commands or files. Do not swap libraries. Do not add features that are not listed (see section 19).
3. If something is not specified, choose the simplest option that fits the Decision Log (section 3) and the Design System (section 12).
4. Build in the order of section 17. After each step, make sure the app compiles.
5. When finished, tell the user the "Manual steps" from section 2 in plain language.

---

## 1. Product in one paragraph

**Couch Clash** is a web app for two people (up to 4 for the card game) on one couch. A **TV** (or any big screen with a browser) shows the game. Each person's **phone is their controller**. Games: **Tic-Tac-Toe**, **Chess**, **Wild Cards** (an Uno-style card game). There are no accounts and no passwords. Each home ("household") is remembered automatically on each device, keeps a history of matches and win records, and can be deleted by the players at any time. The whole app is one React web app that turns into a TV view or a phone view depending on the device. The look is warm, chunky, playful, modern and cozy, with big text.

The app name is a constant `APP_NAME = "Couch Clash"` in `src/lib/constants.ts`. Use it everywhere; never hard-code the name elsewhere.

## 2. Manual steps the human must do (tell them at the end)

1. **Supabase → Authentication → Sign In / Providers → enable "Allow anonymous sign-ins".** The app depends on this. If it is off, the app must show a full-screen "Setup needed" screen (see section 15) explaining this.
2. Run the SQL migration in section 7 (create it as `supabase/migrations/001_init.sql` and apply it through the Supabase integration).
3. **Deploy the app** (Bolt "Publish" / Netlify) before testing with real phones. A Bolt preview URL cannot be opened from a phone. Test on the deployed URL: open `/tv` on the big screen, scan the QR with the phone.
4. Environment variables (in Bolt/Netlify): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Optional: `VITE_PUBLIC_APP_URL` (the deployed https URL; used inside QR codes; if empty use `window.location.origin`).
5. Make sure `public/_redirects` exists with exactly this line so deep links like `/join/K7P2QX` work on Netlify: `/* /index.html 200`

## 3. Decision log (already decided — do not revisit)

| Topic | Decision |
|---|---|
| Stack | Vite + React 18 + TypeScript + Tailwind CSS 3 + Supabase (Postgres, Realtime, anonymous auth). No Next.js. |
| Identity | **Supabase anonymous sign-in.** Every device silently gets a private ID stored in its own browser storage. No login screens. |
| "Remember the TV by IP" | **Rejected.** IP addresses are shared by every device on the same Wi-Fi and change often. Instead each device stores a private ID plus a `household_id` locally, and a 6-character **home code** (shown as a QR) links devices. Do not read, store or send any IP address. |
| Who runs the game rules | **The TV is the referee.** Phones only send *commands*. The TV validates them with pure TypeScript game engines and commits the result to Supabase via RPC functions. Phones never write game state. |
| Secrets (card hands, draw pile) | Stored in tables protected by row-level security. Phones can only read their own hand. The draw pile is readable by the TV only. |
| Turn timers, AI opponents, chat, accounts | Not in v1. |
| Card game name | The UI calls it **"Wild Cards"**. Never use the word "UNO", its logo, or its artwork anywhere. Rules are the standard shedding-card rules in section 10.3. |
| TV has no interactive controls | The TV screen is display-only (TV remotes are bad at web UIs). All menus and choices happen on phones. |

## 4. Tech stack and pinned packages

Install exactly:

- `react-router-dom@6`
- `@supabase/supabase-js@2`
- `zustand@4`
- `chess.js@1` (import `{ Chess } from 'chess.js'`)
- `react-chessboard@^4.7.0` (**major version 4 only. Do NOT install v5; its API is different.**)
- `qrcode.react@4` (use `QRCodeSVG`)
- `framer-motion@11`
- `canvas-confetti@1`
- `lucide-react` (icons; already in the Bolt template)
- Dev: `vitest`, `@types/canvas-confetti`

Fonts (Google Fonts `<link>` in `index.html`, with `display=swap`): **Lilita One** (display, buttons, big numbers, codes) and **Fredoka** weights 400, 500, 600, 700 (body/UI). Font stack: `'Lilita One', 'Fredoka', ui-rounded, system-ui, sans-serif` for display; `'Fredoka', ui-rounded, system-ui, sans-serif` for body.

`index.html` head must include:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#14101F" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<title>Couch Clash</title>
```

## 5. Roles, routes and device detection

There are two roles: `tv` and `phone`. Storage keys (all in `localStorage`, prefix `cc.`): `cc.role`, `cc.householdId`, `cc.playerId` (phone only).

### Routes
| Path | What it does |
|---|---|
| `/` | Runs `detectRole()`, then redirects to `/tv` or `/play` |
| `/tv` | TV app (forces role `tv`, saves `cc.role=tv`) |
| `/play` | Phone app (forces role `phone`, saves `cc.role=phone`) |
| `/join/:code` | Phone join flow for a home code (forces role `phone`). `:code` is uppercased and trimmed. |

Every route first runs the **auth boot** (section 6.1). Unknown paths redirect to `/`.

### `detectRole()` — implement exactly
```ts
const TV_UA = /SmartTV|SMART-TV|Tizen|Web0S|WebOS|NetCast|HbbTV|BRAVIA|VIDAA|Roku|AFTM|AFTB|AFTT|AFTS|AFTN|CrKey|AppleTV|GoogleTV|Android TV|Hisense|Philips|Opera TV|Xbox|PlayStation|NintendoBrowser/i;

export function detectRole(): 'tv' | 'phone' {
  const q = new URLSearchParams(location.search).get('role');
  if (q === 'tv' || q === 'phone') { localStorage.setItem('cc.role', q); return q; }
  const stored = localStorage.getItem('cc.role');
  if (stored === 'tv' || stored === 'phone') return stored;
  if (TV_UA.test(navigator.userAgent)) return 'tv';
  const noTouch = (navigator.maxTouchPoints ?? 0) === 0;
  const landscape = window.innerWidth > window.innerHeight;
  const wide = window.innerWidth >= 900 || window.screen.width * (window.devicePixelRatio || 1) >= 1900;
  return noTouch && landscape && wide ? 'tv' : 'phone';
}
```
Reason: many TVs report a 960px-wide viewport (1080p at 2x pixel ratio), and phones have touch. Detection happens **once at load**; resizing the window never switches roles.

A small text link at the bottom of both roles' idle screens switches role: on TV "Not a TV? Use as a controller"; on phone (Settings screen only) "Use this device as the TV". Switching writes `cc.role` and navigates.

## 6. Identity, pairing and recovery

### 6.1 Auth boot (runs on every route)
1. `supabase.auth.getSession()`. If there is no session, call `supabase.auth.signInAnonymously()`.
2. If sign-in fails with any error mentioning "anonymous" or "disabled", render the **Setup needed** screen (section 15) and stop.
3. Store the session in the default supabase-js storage (`persistSession: true`, `autoRefreshToken: true`).

### 6.2 TV first run
1. Read `cc.householdId`. If present, verify it (`select id from households where id = ...` returns a row **and** `select id from devices where household_id = ... and auth_uid = <my uid>` returns a row). If either is missing, clear the stored id and treat as first run.
2. First run: call RPC `create_tv_household()`; store returned `id` in `cc.householdId`.
3. Show the **TV Pairing** or **TV Home** screen depending on whether the household has any players.

### 6.3 Phone join flow (`/join/:code` or code typed on `/play`)
1. Call RPC `preview_household(code)`. Errors: `invalid_code` → show "That code doesn't match any TV" with a retry input.
2. Let `local = cc.householdId` and `target = preview.household_id`.
   - If `local === target` and the phone already has `cc.playerId` → go to Phone Home.
   - If `local` exists, `local !== target`, and the target household **has no players** (a fresh TV) → show sheet "New TV spotted. Move it into your home?" with buttons **"Yes, link this TV"** (call RPC `link_tv(target, local)`, then go Home) and **"No"**. This is how an existing home recovers after a TV forgot itself.
   - If `local` exists, `local !== target`, and the target has players → sheet "This TV belongs to another home. Join it as a new player?" **"Join"** continues to step 3 (and overwrites `cc.householdId`), **"Cancel"** goes back.
   - Otherwise continue to step 3.
3. **Who are you?** screen: if the household already has players, list them as big avatar buttons (tap → RPC `claim_player(code, player_id)`; this is how a phone recovers its profile) plus a button **"I'm someone new"**. If it has no players, go straight to step 4.
4. **Create profile** screen: name (max 20 chars, required), emoji (12 choices: 🦊 🐼 🐯 🐸 🦄 🐙 🐧 🦁 🐨 🐰 🦉 🐳), color (6 choices, see design tokens; default is the first color not used by others). Submit → RPC `join_household(code, name, emoji, color)`. Errors: `household_full` → "This home already has 4 players." `already_joined` → go Home.
5. Store `cc.householdId` and `cc.playerId`. Navigate to `/play`.

### 6.4 Phone with no stored home
`/play` with no `cc.householdId` shows **Enter code** screen: six big single-character boxes (auto-advance, uppercase, allowed characters `ABCDEFGHJKMNPQRSTUVWXYZ23456789`), and text "Or point your camera at the QR code on the TV". Submitting runs the flow in 6.3.

### 6.5 Health check
Every 20 seconds and on `visibilitychange` (when visible), each device checks its household still exists and its device row still exists. If not (someone deleted the home), wipe `cc.householdId`, `cc.playerId`, reset stores and show the first-run screen for that role. Realtime DELETE events are not reliable; this poll is the mechanism.

### 6.6 Presence
Each device joins Realtime channel `hh:<householdId>` and calls `track()`: TV tracks `{kind:'tv'}`; phone tracks `{kind:'phone', playerId}`. Presence key = the device's auth uid. A player is **online** if any presence entry has their `playerId`. The TV is **online** if any entry has `kind:'tv'`.

## 7. Database (create exactly this as `supabase/migrations/001_init.sql`)

```sql
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
```

RPC call convention: `supabase.rpc('name', { p_code: ..., ... })` using the exact parameter names above. Map thrown error messages (the string after `raise exception`) to the friendly messages in section 15.

## 8. Realtime and the command protocol

### 8.1 Subscriptions (all filtered by `household_id=eq.<id>`, using `postgres_changes`)
- **Both roles:** `households` (UPDATE, for settings), `players` (INSERT/UPDATE/DELETE), `matches` (INSERT/UPDATE).
- **Phone:** `hands` (INSERT/UPDATE) — Row-level security means it only ever receives its own hand. Also `commands` UPDATE (to show a toast when its own command is rejected).
- **TV:** `commands` INSERT.
- **Safety nets (must implement):** on channel (re)connect and on `visibilitychange`, refetch the active match, own hand (phone), players and household. After every `matches` UPDATE event, a phone refetches its own hand row. The TV additionally polls `commands` where `status='pending'` every 5 seconds.

### 8.2 Phones send commands
Insert into `commands`: `{ household_id, player_id, match_id, type, payload }`. Nothing else. Phone UI must **not** assume success: it waits for the `matches` update. If the phone's command comes back `rejected`, show a toast using the reason (section 15). If nothing happens for 4 seconds, show toast "Hmm, the TV didn't answer. Check the TV is on."

Command types and payloads (exact):

| type | payload | match_id | Notes |
|---|---|---|---|
| `start_match` | `{ game: 'tictactoe'\|'chess'\|'cards', seats: string[] }` | null | `seats` = player ids. tictactoe/chess: exactly 2. cards: 2 to 4. Sender must be in `seats`. All seat players must be online. TV shuffles the seat order (random first player) and abandons any active match. |
| `rematch` | `{}` | id of finished match | Valid only if that match is finished and no match is active. TV rotates seats (`[...seats.slice(1), seats[0]]`) and starts a new match of the same game. |
| `quit_match` | `{}` | active match id | Any seat player. Match becomes `abandoned` (no stats). |
| `move` | tictactoe `{ cell: 0-8 }`; chess `{ from:'e2', to:'e4', promotion?:'q'\|'r'\|'b'\|'n' }` | active match id | |
| `resign` | `{}` | chess match id | Sender loses; result `resign`. |
| `offer_draw` | `{}` | chess match id | |
| `respond_draw` | `{ accept: boolean }` | chess match id | Only the other player. |
| `play` | `{ cardId: string, chosenColor?: 'red'\|'yellow'\|'green'\|'blue', shout?: boolean }` | cards match id | |
| `draw` | `{}` | cards match id | |
| `pass` | `{}` | cards match id | Only valid right after drawing a playable card. |

### 8.3 The TV command processor (`useCommandProcessor`, runs only in the TV role)
- A single async queue (mutex). Commands are processed in ascending `id`.
- For each pending command:
  1. If `created_at` is older than 5 minutes → `resolve_command(id,'rejected','stale')`.
  2. Load context (cache the active match, its hands and secrets in memory; reload from Supabase on start and after any `version_conflict`).
  3. Validate and run the pure engine (section 10). If the engine returns `{ok:false, reason}` → `resolve_command(id,'rejected',reason)`.
  4. If ok → for a new match call `create_match(...)`; otherwise `commit_turn(...)` with `p_expected_version` = cached version. On `version_conflict`, reload and retry that command once.
- Chess and tic-tac-toe engines do not use `hands`/`secrets`; pass `null`.
- TV must stay idempotent: never process a command whose status is not `pending`.

## 9. Shared TypeScript types (`src/types/`)

```ts
export type GameKey = 'tictactoe' | 'chess' | 'cards';
export type PlayerColor = 'coral' | 'sun' | 'mint' | 'sky' | 'grape' | 'rose';
export interface HouseholdSettings { lastCardPenalty: boolean; sound: boolean; moveHints: boolean }
export interface Household { id: string; join_code: string; settings: HouseholdSettings; created_at: string }
export interface Player { id: string; household_id: string; auth_uid: string | null; name: string; emoji: string; color: PlayerColor; created_at: string }
export type MatchStatus = 'active' | 'finished' | 'abandoned';
export interface Match<S = unknown> {
  id: string; household_id: string; game: GameKey; status: MatchStatus; seats: string[];
  state: S; version: number; winner_id: string | null; result: string | null;
  created_at: string; updated_at: string; finished_at: string | null;
}
export type CommandType = 'start_match' | 'rematch' | 'quit_match' | 'move' | 'resign' | 'offer_draw' | 'respond_draw' | 'play' | 'draw' | 'pass';
export interface Command { id: number; household_id: string; player_id: string; match_id: string | null; type: CommandType; payload: Record<string, any>; status: 'pending' | 'accepted' | 'rejected'; reason: string | null; created_at: string }

export type RejectReason = 'not_your_turn' | 'illegal_move' | 'cell_taken' | 'bad_request' | 'match_over' | 'no_active_match'
  | 'player_offline' | 'stale' | 'card_not_playable' | 'must_play_drawn' | 'already_drawn' | 'cannot_pass'
  | 'wild4_not_allowed' | 'color_required' | 'no_draw_offer' | 'not_a_seat';

export interface EngineOk<S> {
  ok: true; state: S; status: 'active' | 'finished';
  winnerId: string | null;                 // null with status 'finished' means a draw
  result: string | null;                   // see result codes below
  hands?: Record<string, Card[]>;          // cards game only: FULL replacement hands for players who changed
  secrets?: CardsSecrets;                  // cards game only
}
export interface EngineErr { ok: false; reason: RejectReason }
export type EngineResult<S> = EngineOk<S> | EngineErr;
```
**Result codes** stored in `matches.result`: tictactoe `three_in_row` | `draw`; chess `checkmate` | `stalemate` | `insufficient` | `threefold` | `fifty_move` | `draw_agreed` | `resign`; cards `emptied_hand`; any abandoned match `quit`.

Each game folder exports pure functions (no React, no Supabase; unit-testable):
```ts
createInitial(seats: string[], rng?: () => number): { state: S; hands?: Record<string, Card[]>; secrets?: CardsSecrets }
applyCommand(ctx: { seats: string[]; state: S; hands?: Record<string, Card[]>; secrets?: CardsSecrets; settings: HouseholdSettings },
             cmd: { playerId: string; type: CommandType; payload: any }): EngineResult<S>
```
Random numbers come from `src/lib/rng.ts`: a Fisher–Yates `shuffle` using `crypto.getRandomValues`.

## 10. The three games

**Seat rules:** `seats[0]` moves first. Tic-tac-toe: seats[0]=X, seats[1]=O. Chess: seats[0]=White, seats[1]=Black.

### 10.1 Tic-Tac-Toe
State: `{ board: ('X'|'O'|null)[9]; turn: string /*playerId*/; winLine: number[] | null; moveCount: number }`.
`move {cell}`: reject `not_your_turn` (not turn) → `bad_request` (cell not integer 0-8) → `cell_taken`. Place the mark. If any of the 8 lines is complete: `finished`, winner = mover, result `three_in_row`, `winLine` set. Else if `moveCount===9`: finished, winner null, `draw`. Else swap turn.

### 10.2 Chess
Use chess.js. State:
```ts
{ moves: { from: string; to: string; promotion?: string }[];   // source of truth
  fen: string; turn: 'w' | 'b'; white: string; black: string;   // player ids
  inCheck: boolean; lastMove: { from: string; to: string } | null;
  san: string[];                                                 // move list in SAN
  captured: { w: string[]; b: string[] };                        // pieces captured BY that colour, lowercase types 'p','n','b','r','q'
  drawOfferFrom: string | null }
```
Always rebuild the game by replaying `moves` from the starting position (needed for threefold repetition after a reload).
- `move`: not the mover's turn → `not_your_turn`. Try `chess.move({from,to,promotion})` inside try/catch; exception → `illegal_move`. If a pawn reaches the last rank and `promotion` is missing, default to `'q'`. Record SAN, captured piece, `lastMove`, `inCheck = chess.isCheck()`, clear `drawOfferFrom`.
- After the move, in this order: `isCheckmate()` → finished, winner mover, `checkmate`; `isStalemate()` → draw `stalemate`; `isInsufficientMaterial()` → draw `insufficient`; `isThreefoldRepetition()` → draw `threefold`; `isDraw()` → draw `fifty_move`.
- `resign`: finished, winner = the other player, `resign`.
- `offer_draw`: sets `drawOfferFrom` (reject `bad_request` if one is already pending).
- `respond_draw`: sender must not be the offerer (else `bad_request`); `no_draw_offer` if none. `accept` → finished, winner null, `draw_agreed`; decline → `drawOfferFrom = null`.
- No clocks, no undo.

### 10.3 Wild Cards (Uno-style; 2 to 4 players)
Types:
```ts
export type CardColor = 'red' | 'yellow' | 'green' | 'blue';
export interface Card { id: string; kind: 'number'|'skip'|'reverse'|'draw2'|'wild'|'wild4'; color: CardColor | null; value?: number }
export interface CardsSecrets { drawPile: Card[]; discardPile: Card[] }   // discardPile = every card under the top card
export interface CardsState {
  topCard: Card; currentColor: CardColor; direction: 1 | -1; turnIndex: number;
  handCounts: Record<string, number>; drawCount: number; discardCount: number;
  pendingDraw: { playerId: string; cardId: string } | null;   // set after drawing a playable card
  lastAction: { playerId: string; type: 'play'|'draw'|'pass'; card?: Card; chosenColor?: CardColor; victimId?: string; penalty?: number; shout?: boolean } | null;
  log: string[];                                              // last 12 short lines, e.g. "Sam played Skip"
}
```
**Deck (108):** per colour: one `0`, two each of `1–9`, two each of `skip`, `reverse`, `draw2` (25 per colour = 100), plus 4 `wild` and 4 `wild4` (color null). Card ids `c001…c108`.

**Setup (`createInitial`):** shuffle; deal 7 to each seat; flip cards from the draw pile until a **number card** appears — non-number cards flipped meanwhile go back into the draw pile, which is reshuffled once a number card is found. That number card is `topCard`, `currentColor` = its color, `direction = 1`, `turnIndex = 0`.

**Playable rule** `isPlayable(card, top, currentColor, hand)` (exported and used by both engine and UI):
- `wild`: always.
- `wild4`: only if the hand contains **no** card whose color equals `currentColor` (wild cards do not count).
- Colored card: `card.color === currentColor`, OR same kind as `top` for action cards (`skip`/`reverse`/`draw2`), OR same `value` as `top` for number cards when `top.kind === 'number'`.

**`play {cardId, chosenColor?, shout?}`** — reject in this order: `not_your_turn`; if `pendingDraw` exists and `cardId` differs → `must_play_drawn`; card not in hand → `bad_request`; not playable → `wild4_not_allowed` (for wild4) or `card_not_playable`; wild/wild4 without a valid `chosenColor` → `color_required`. Then:
1. Remove from hand; push the old `topCard` onto `discardPile`; new `topCard` = played card; `currentColor` = `chosenColor` (wilds) or the card's color.
2. Effects (`next` = next seat in `direction`): `number`/`wild` → advance 1. `skip` → advance 2. `reverse` → with 2 players it acts as skip (advance 2); with 3–4 players flip `direction`, then advance 1. `draw2` → `next` draws 2, advance 2. `wild4` → `next` draws 4, advance 2. No stacking of draw cards.
3. Last-card rule: if the actor now holds exactly **1** card and `settings.lastCardPenalty` is true and `shout` is not true → actor immediately draws 2 penalty cards (`lastAction.penalty = 2`, log "forgot to shout LAST CARD"). If they shouted, log "shouted LAST CARD".
4. If the actor's hand is empty → `finished`, winner = actor, result `emptied_hand` (still apply the played card's draw effect first; do not advance further).
5. Clear `pendingDraw`. Update `handCounts`, `drawCount`, `discardCount`, `lastAction`, `log`.

**`draw`** — `not_your_turn`; if `pendingDraw` exists → `already_drawn`. Draw 1 card. If it is playable (same `isPlayable` including the wild4 rule), set `pendingDraw` and keep the turn (the player may `play` that card or `pass`). If not playable, the turn advances 1 automatically.
**`pass`** — only valid when `pendingDraw` belongs to the sender, else `cannot_pass`. Clears `pendingDraw`, advances 1.
**Drawing from an empty draw pile:** shuffle `discardPile` into `drawPile` first; if still not enough cards, give as many as exist.
**Hands** returned by the engine are the full new hands for every player whose hand changed. **Secrets** are always returned in full when they change.
`advance(n)`: `turnIndex = ((turnIndex + direction * n) % len + len) % len`.

### 10.4 Stats
Computed client-side from `matches` where `status='finished'` (fetch the latest 500). Per game: wins per player and draws. Head-to-head text on the TV Home cards: `Alex 7 · Sam 5 · Draws 2` (draws hidden when 0; players with no player row show as "Former player").

## 11. Screens

### 11.1 TV screens (display-only; no buttons; all text ≥ 2.4vh)
Root: full-viewport, `overflow: hidden`, padding `3vh 3.5vw` (overscan-safe), `cursor: none`, `html { font-size: 2vh }` (so `1rem = 2vh`; layouts use `rem`, `vh`, `vw` only, designed for 16:9, must also look right at 16:10 and 4:3).

1. **TV Boot** — centered logo (name in Lilita One, 14vh, sun-yellow with a coral hard-shadow) bouncing gently on the warm background; text "Warming up the couch…".
2. **TV Pairing** (household has 0 players) — two-column layout. Left: a white rounded tile (padding 3vh) holding the QR (`QRCodeSVG`, level `M`, size 36vh) with the 6-character code under it in Lilita One at 9vh, letter-spacing 0.18em. Right: headline "Grab your phone" (7vh), three numbered steps (big circles): "1 Point your camera at the code", "2 Pick a name and a face", "3 Choose a game on your phone". Below: two empty player slots (dashed circles) that fill with avatars live as people join. Footer (2.4vh, dim): "Not a TV? Use as a controller".
3. **TV Home** (≥ 1 player, no active match, no recent result) — Top bar: household title ("Alex & Sam's place", "Alex's place", or "Your place") on the left; on the right the player chips (avatar, name, green/grey online dot). Centre: three huge game cards in a row (each 28vw × 44vh): icon art (see 12.6), title (6vh), one-line tagline, and the head-to-head record. Under the cards: a big rounded banner "Pick a game on your phone" with a subtle bouncing phone icon. Bottom-right corner: a small QR tile (14vh) with the code and "Add a phone" (shown always if < 4 players; also serves as reconnect). If an active match exists it is shown as a **Resume** banner above the cards ("Chess in progress — Alex vs Sam · move 14") and the phones offer "Continue".
4. **TV Match** — chosen by `match.game`; details in 11.3 to 11.5. A thin top strip shows the game name and a small "TV online" pulse. Player panels use each player's color.
5. **TV Result** — shown for 30 seconds after a match finishes, or until a `rematch`/`start_match` arrives (then goes to the new match), then returns to Home. Full-screen overlay: confetti (canvas-confetti, from both bottom corners, 3 bursts) if there is a winner; big text "**Sam wins!**" (11vh) with the winner's avatar bouncing; for a draw "**It's a draw!**" with both avatars; a line naming how it ended (e.g. "Checkmate in 23 moves", "Three in a row", "First to empty their hand"); updated head-to-head record; hint "Rematch on your phone".
6. **TV Offline** — if the TV loses its connection: dim the screen with the message "Reconnecting…" and a spinner; retries automatically.

### 11.2 Phone screens (mobile-first, 360–430px wide, portrait; must also work landscape)
Global phone rules: root height `100dvh`; respect `env(safe-area-inset-*)`; `touch-action: manipulation`; `user-select: none`; `overscroll-behavior: none`; buttons and tap targets ≥ 56px; use bottom sheets (not centered modals) for choices and confirmations; a persistent slim status bar at the top (player avatar + name, and a chip "TV connected" green / "TV offline" red). When the TV is offline all game controls are disabled and a banner reads "Waiting for the TV…".

1. **Enter code** — see 6.4.
2. **Who are you? / Create profile** — see 6.3. Avatar grid 4×3, color chips as 44px circles.
3. **Phone Home** — greeting "Hey {name}!" (Lilita One, 32px), partner status line ("Sam is online" / "Sam is offline"), a **Resume** card when a match is active (game name, opponent, "Continue"), three big game tiles stacked vertically (each 96px tall: icon, title, tagline, record chip). Tap a tile → **Start sheet**: for tictactoe/chess with exactly one other player, "Play {Game} with {Other}?" with **"Let's go"** (sends `start_match`). If more than one other player is online, show a chooser (chess/tictactoe: pick one opponent; cards: checkboxes, all online players pre-selected, minimum 2 total). If the other player is offline show "{Other} isn't connected yet." with the button disabled. If a match is active add a warning line "This ends the match in progress." Bottom nav with 3 icons: Home, Stats, Settings.
4. **Phone Match** — chosen by game; details in 11.3 to 11.5. Top-right "⋯" menu opens a sheet with **Quit match** (confirm) and, for chess, **Offer draw** / **Resign** (confirm).
5. **Phone Result** — same message as TV Result, smaller, with two buttons: **Rematch** (sends `rematch`) and **Back to menu**. If the other player already pressed Rematch (new match appears) it auto-navigates into the new match.
6. **Stats** — segmented control for the three games; per-game head-to-head bar (two colored segments plus a grey segment for draws) and the 15 most recent matches (winner avatar, game, result text, relative time).
7. **Settings** — sections: **Profile** (edit name/emoji/color, saves through the `players` update policy); **Game options** (toggles: "Last-card penalty" for Wild Cards, "Sounds on TV", "Show legal-move dots in chess") saved via `update_settings`; **Link a TV** (enter a code; runs the 6.3 link flow); **Players** (list with a "Remove" button per player, confirm sheet, calls `remove_player`); **Your data** (small text: "We store your names, emojis and match history. Nothing else. No emails, no passwords, no IP addresses."); **Clear match history** (confirm, calls `clear_history`); **Delete everything** (danger card, red; sheet asks the person to type `DELETE`, then calls `delete_household`, wipes local storage, returns to first-run); **Use this device as the TV**.

### 11.3 Tic-Tac-Toe views
- **TV:** board centered, 3×3, cells 20vh × 20vh, gap 1.6vh, rounded 3vh, `--bg-2` fill with a hard bottom shadow. X = coral, O = sky, drawn as chunky SVG strokes (stroke-width 12, round caps) that animate in over 250ms (stroke-dashoffset). Winning line: a thick sun-yellow line drawn across the three cells (animated 400ms) and the other cells dim to 35%. Left and right panels show each player (avatar 14vh, name 5vh, their mark big, glowing ring + "Your move" label on whoever's turn it is). Top center label: "{Name}'s turn".
- **Phone:** board fills the width (max 420px, square). Own mark and color shown in the status strip ("You are X"). Tap an empty cell on your turn to send `move`; the tapped cell pulses until the state updates. When not your turn cells are non-interactive and the banner says "{Name} is thinking…". On your turn the banner says "Your move!" and the board gets a soft glow.

### 11.4 Chess views
Board: `react-chessboard` v4 with these props: `position={fen}`, `boardOrientation`, `arePiecesDraggable={false}`, `onSquareClick`, `customSquareStyles`, `customDarkSquareStyle={{ backgroundColor: '#B9855E' }}`, `customLightSquareStyle={{ backgroundColor: '#F4E3C3' }}`, `customBoardStyle={{ borderRadius: 16, boxShadow: '0 8px 0 rgba(0,0,0,.35)' }}`, `animationDuration={200}`, `boardWidth` computed from the container.
- **TV:** board on the left, white at the bottom always, size `min(88vh, 56vw)`. Highlights: last move from/to squares tinted `rgba(255,200,87,.55)`; king in check gets a red radial glow. Right column: black player panel on top, move list in the middle (SAN pairs, "1. e4 e5", latest highlighted, auto-scrolls, shows last 10 pairs), white player panel at the bottom. Each panel: avatar, name, "captured" row of small piece letters/icons with material difference (+3), turn glow. Banner strip for "Check!", "Checkmate", or "{Name} offers a draw".
- **Phone:** board width = viewport width − 24px (max 480px), oriented so **your color is at the bottom**. Above: opponent bar; below: your bar (name, captured pieces, turn indicator). Interaction: tap one of your pieces on your turn → highlight the square (sun-yellow) and, if `moveHints` is on, show dots on legal destinations (compute legal moves on the phone with chess.js from the FEN, `moves({square, verbose:true})`); tap a destination → send `move`. Tapping another own piece re-selects; tapping elsewhere clears. If the move is a promotion, first show a bottom sheet with four big labeled buttons (Queen, Rook, Bishop, Knight; the letter Q/R/B/N in a chunky tile) and send `promotion` accordingly. If the opponent has offered a draw, show a bottom sheet "Sam offers a draw" with **Accept** and **Decline** (sends `respond_draw`). Buttons under the board: **Offer draw**, **Resign** (each opens a confirm sheet).

### 11.5 Wild Cards views
Card visuals (drawn with CSS + inline SVG, no images): rounded rectangle, 3px cream border, colored face; a tilted white oval in the middle holding the symbol; small corner symbols. Symbols: numbers in Lilita One; skip = circle with diagonal slash; reverse = two opposing arrows; draw2 = "+2"; wild = four-color pie; wild4 = "+4" over the pie. Add a tiny color-blind marker in the corners: red ▲, yellow ●, green ◆, blue ■ (as SVG shapes, not text glyphs). Card back: `--bg-2` with a sun-yellow tilted oval and the initials "CC".
- **TV:** felt-like table (radial gradient of `--bg-1` to `--bg-0`). Center: draw pile (face-down stack with count badge) on the left and the discard pile (top card, large, 30vh tall) on the right; a colored glow ring around the discard pile in `currentColor`; a slowly rotating arrow ring around the piles showing `direction`. Players sit around the table (2 players: top and bottom; 3–4: spread evenly): avatar, name, fan of face-down cards (max 10 drawn, then "+N"), card count, glowing outline on whoever's turn it is. A toast strip near the middle shows the latest log line (e.g. "Sam played Skip. Alex loses a turn!") for 3 seconds. When anyone has 1 card: a pulsing "LAST CARD!" tag on their panel. **The TV never shows anyone's hand.**
- **Phone:** top: compact status row (top card small, current color chip, draw pile count, opponent card counts with avatars). Middle: big banner "Your turn!" / "{Name}'s turn". Bottom 45% of the screen: the player's hand as a horizontally scrollable row of cards (each 22vw wide, min 84px), sorted by color (red, yellow, green, blue, wild) then number/kind. **Playable cards** are full brightness; **unplayable** are dimmed to 40%. Tap a playable card once → it lifts 24px and the primary button reads **PLAY**; tap **PLAY** to send. Tapping another card changes the selection. A wild/wild4 selection opens a bottom sheet with four huge color buttons first, then sends `play` with `chosenColor`. Buttons: **DRAW** (always on your turn unless `pendingDraw`), **PASS** (only when `pendingDraw` is yours; also the drawn card is highlighted and auto-selected), and a **LAST CARD!** toggle button that appears only when the hand has exactly 2 cards and `lastCardPenalty` is on; it sends `shout:true` with the next `play`. When not your turn the hand is visible but non-interactive.

## 12. Design system

Mood: a cozy dark living room at night with a warm lamp glow; chunky sticker-style buttons; rounded everything; playful but not childish.

### 12.1 Tokens (CSS variables in `src/index.css`, mirrored in `tailwind.config.js` under `theme.extend.colors`)
```css
:root {
  --bg-0: #14101F;  --bg-1: #1E1730;  --bg-2: #2A2142;  --bg-3: #382C58;
  --ink: #FFF6E9;   --ink-dim: #B9AED0;  --line: rgba(255,246,233,.12);
  --coral: #FF6B6B; --sun: #FFC857; --mint: #3DDC97; --sky: #4DB8FF; --grape: #A78BFA; --rose: #FF7EB6;
  --card-red: #FF5A5F; --card-yellow: #FFC83D; --card-green: #34D399; --card-blue: #4DA3FF;
  --danger: #FF4D4D; --ok: #3DDC97;
  --radius-sm: 14px; --radius: 22px; --radius-lg: 32px;
  --shadow-hard: 0 6px 0 rgba(0,0,0,.35);
  --shadow-soft: 0 18px 40px rgba(0,0,0,.35);
}
body { background: var(--bg-0); color: var(--ink); font-family: 'Fredoka', ui-rounded, system-ui, sans-serif; font-weight: 500; }
```
Background: `radial-gradient(60vmax 60vmax at 15% -10%, rgba(255,200,87,.16), transparent 60%), radial-gradient(50vmax 50vmax at 100% 110%, rgba(167,139,250,.18), transparent 60%), var(--bg-0)` (a warm lamp glow top-left, grape glow bottom-right). Optional slow drift animation of 40s that stops under `prefers-reduced-motion`.

### 12.2 Type scale
| Use | Phone | TV |
|---|---|---|
| Display / logo / winner text | Lilita One 44px | Lilita One 11–14vh |
| H1 | Lilita One 32px | 7vh |
| H2 | Lilita One 24px | 4.5vh |
| Body | Fredoka 500 18px | 3vh |
| Small / captions | Fredoka 500 14px | 2.4vh (minimum on TV) |
| Buttons | Lilita One 22px | n/a |
| Join code | Lilita One 40px, letter-spacing .18em | 9vh |

### 12.3 Buttons
Chunky pill, min-height 56px, padding 0 28px, font Lilita One 22px, border-radius 999px, 3px darker outline, `box-shadow: var(--shadow-hard)`. Pressed state: `translateY(4px)` and shadow reduced to `0 2px 0`. Variants: **primary** = `--sun` fill with `--bg-0` text; **secondary** = `--bg-3` fill with `--ink` text; **danger** = `--danger` fill; **ghost** = transparent with `--line` border. Disabled: 40% opacity, no shadow motion.

### 12.4 Cards / panels / sheets
Panels: `--bg-2` fill, radius `--radius`, 1px `--line` border, `--shadow-soft`. Bottom sheets: slide up (framer-motion spring, 260ms), radius 32px on top corners, a 5px grab handle, backdrop `rgba(10,7,18,.6)`. Player chips: pill with avatar emoji in a circle filled with the player's color, name in Fredoka 600.

### 12.5 Player color hex
coral `#FF6B6B`, sun `#FFC857`, mint `#3DDC97`, sky `#4DB8FF`, grape `#A78BFA`, rose `#FF7EB6`. Text on these fills is `--bg-0`.

### 12.6 Game icons (inline SVG, 96×96 viewBox, chunky 6px strokes, drawn in code)
Tic-Tac-Toe: a # grid with an X (coral) and an O (sky). Chess: a stylized knight silhouette in cream. Wild Cards: two overlapping tilted cards (coral and sky) with a sun-yellow oval.

### 12.7 Motion, sound, haptics
- Motion: framer-motion. Screen transitions 250ms fade + 12px rise. Buttons spring on press. New pieces/marks pop in (scale 0.6 → 1). Respect `prefers-reduced-motion` (disable drift, bounces and confetti).
- TV sounds (only if `settings.sound`): synthesized with the Web Audio API, no audio files. Tap/move: 660Hz sine, 90ms. Your-turn chime: 523Hz then 784Hz, 120ms each. Win: arpeggio 523, 659, 784, 1047Hz, 140ms each. Create the AudioContext lazily; if the browser blocks it, fail silently.
- Phone haptics: `navigator.vibrate?.(15)` on your turn starting and on a rejected command `[30,40,30]`.
- **Wake lock:** both roles request `navigator.wakeLock.request('screen')` while a match is active or the TV is on Home, re-request on `visibilitychange`, and ignore errors.

## 13. Folder structure (create exactly)
```
public/_redirects
supabase/migrations/001_init.sql
src/main.tsx, App.tsx (router + auth boot + role redirect)
src/index.css
src/lib/{constants.ts, supabase.ts, device.ts, rng.ts, sound.ts, haptics.ts, wakeLock.ts, codes.ts, errors.ts}
src/types/{db.ts, games.ts}
src/store/{session.ts, match.ts}             // zustand
src/hooks/{useAuthBoot, useHousehold, usePresence, useActiveMatch, useMyHand, useCommandProcessor, useSendCommand, useStats, useHealthCheck}
src/games/registry.ts                        // key -> {label, tagline, minPlayers, maxPlayers, icon, TvView, PhoneView, engine}
src/games/tictactoe/{engine.ts, engine.test.ts, TvBoard.tsx, PhoneBoard.tsx}
src/games/chess/{engine.ts, engine.test.ts, TvBoard.tsx, PhoneBoard.tsx, PromotionSheet.tsx}
src/games/cards/{engine.ts, engine.test.ts, deck.ts, CardView.tsx, TvTable.tsx, PhoneHand.tsx, ColorSheet.tsx}
src/screens/tv/{TvApp.tsx, TvBoot.tsx, TvPairing.tsx, TvHome.tsx, TvMatch.tsx, TvResult.tsx, TvOffline.tsx}
src/screens/phone/{PhoneApp.tsx, EnterCode.tsx, JoinFlow.tsx, Profile.tsx, PhoneHome.tsx, StartSheet.tsx, PhoneMatch.tsx, PhoneResult.tsx, Stats.tsx, Settings.tsx}
src/components/{Button.tsx, Sheet.tsx, ConfirmSheet.tsx, Avatar.tsx, PlayerChip.tsx, QrTile.tsx, Toast.tsx, Logo.tsx, StatusBar.tsx, SetupNeeded.tsx, BackgroundGlow.tsx}
```

## 14. Data rules
- Never store or transmit IP addresses, emails or any personal data beyond: player name (≤ 20 chars), emoji, color, match history.
- Player deletion (`remove_player`) keeps old matches; stats then show "Former player".
- "Delete everything" removes the household and (by cascade) devices, players, matches, hands, secrets, commands.

## 15. Errors and microcopy

Friendly messages for RPC errors and command rejection reasons (show as toasts on phone; the TV never shows errors except Offline):

| Code | Message |
|---|---|
| `invalid_code` | That code doesn't match any TV. Check the letters and try again. |
| `household_full` | This home already has 4 players. |
| `already_joined` | You're already in this home. |
| `bad_name` | Pick a name up to 20 characters. |
| `forbidden` / `not_authenticated` | Something went wrong with your connection. Reload and try again. |
| `not_your_turn` | Hold on, it's not your turn. |
| `illegal_move` | That move isn't allowed. |
| `cell_taken` | That square is taken. |
| `card_not_playable` | That card doesn't match. |
| `wild4_not_allowed` | You can only play +4 when you have no card of the current color. |
| `must_play_drawn` | Play the card you just drew, or pass. |
| `already_drawn` | You already drew this turn. |
| `cannot_pass` | You can only pass after drawing. |
| `color_required` | Pick a color for your wild card. |
| `player_offline` | Everyone needs to be connected first. |
| `stale` | That took too long. Try again. |
| `match_over` / `no_active_match` | That match has ended. |
| `version_conflict` (TV only) | Reload state and retry silently. |

**Setup needed screen** (full screen, both roles): title "One quick setup step", body "Turn on **Anonymous sign-ins** in your Supabase dashboard (Authentication → Sign In / Providers), then reload this page." with a **Reload** button.

Voice: short, warm, playful. Examples: "Your move!" · "{Name} is thinking…" · "Nice one." · "Ooh, close." · "Rematch?" · "Game night, on the big screen." (tagline under the logo).

## 16. Quality rules
- Everything must work with **only two devices** (one TV tab, one phone) and with **two phones**.
- Nothing may depend on a hover state. All phone tap targets ≥ 56px. All TV text ≥ 2.4vh.
- Never show a raw error, UUID, or stack trace to the user.
- Loading states everywhere data is fetched (skeleton shimmer, `--bg-2`).
- Handle: phone reload mid-match (state restored from Supabase), TV reload mid-match (state restored, pending commands processed), a phone going to the background (on return it resyncs), a second TV tab (version conflict is handled, see 8.3).

## 17. Build order
1. Project setup: dependencies, fonts, tokens, `_redirects`, `index.html` meta, `constants.ts`, background glow, base components.
2. `supabase.ts`, auth boot (including the Setup needed screen), migration file.
3. `detectRole`, routes, role redirect.
4. TV first run and Pairing screen with QR; phone Enter code / Join flow / Profile; presence. Verify two devices see each other online.
5. Phone Home, TV Home, Settings (profile, toggles, delete flows), Stats screen (with empty states).
6. Command pipeline: `useSendCommand`, `useCommandProcessor`, `start_match`, `quit_match`, `rematch`, TV Result screen.
7. Tic-Tac-Toe (engine + tests + both views).
8. Chess (engine + tests + both views).
9. Wild Cards (engine + tests + both views).
10. Polish: motion, sound, haptics, wake lock, offline states, reduced motion.

## 18. Tests and acceptance checklist

Write Vitest tests (`npm run test` must pass) for the engines:
- **Tic-Tac-Toe:** all 8 winning lines; draw on a full board; rejects occupied cell and wrong turn.
- **Chess:** legal move accepted; illegal rejected; checkmate (fool's mate); stalemate; promotion defaults to queen; threefold repetition detected from a replayed move list; resign; draw offer accept/decline.
- **Wild Cards:** deck has 108 cards with the counts in 10.3; setup deals 7 each and the first top card is a number card; playable rules including wild4 restriction; skip, reverse (2 players acts as skip), draw2, wild4 effects; last-card penalty with and without `shout`; draw → pendingDraw → play/pass; reshuffle when the draw pile is empty; win on empty hand.

Manual acceptance (all must pass on the deployed site):
1. Open `/` on a laptop-sized screen: TV Pairing shows a QR and a 6-character code.
2. A phone scans the QR, makes a profile "Alex"; the TV shows Alex online. A second phone joins as "Sam".
3. From a phone, start Tic-Tac-Toe; play to a finish; the TV shows the winner and the record updates on both phones.
4. Same for Chess (including a promotion and an offered draw) and for Wild Cards (Draw, Wild color pick, Last-card toggle).
5. Reload the TV mid-match: the match resumes exactly. Reload a phone mid-match: it resumes exactly with its own hand.
6. Clear the TV's site data, reopen it (new code), scan it from Alex's phone: prompt "Move it into your home?" → after Yes the TV shows Alex & Sam and their records.
7. Clear a phone's site data, scan the TV QR: "Who are you?" lists Alex and Sam; picking Alex restores the profile.
8. Settings → Delete everything (type DELETE): TV and the other phone return to first-run within 20 seconds.

## 19. Non-goals (do not build)
Online play across different homes, user accounts or emails, chat, timers/clocks, AI opponents, tournaments, leaderboards across households, in-app purchases, ads, analytics, push notifications, offline mode/service worker, translations, audio files, image assets, and any game not listed here.
