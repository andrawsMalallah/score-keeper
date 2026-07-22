-- Score Keeper: full schema (init + import_backup RPC + realtime), combined.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Rerunnable from scratch: drops every object this file creates first (data
-- included — teams/matches/rounds/etc. all cascade from the dropped tables),
-- then recreates everything below. Safe on both a fresh project and one
-- that already has this schema applied; auth.users itself is never touched,
-- so existing accounts/sessions survive, only their app data does not.

-- ── Teardown (drop in dependency order; `if exists` makes it safe on a fresh DB) ──
drop trigger if exists on_user_created on auth.users;
drop function if exists seed_new_user();
drop function if exists declare_winner(uuid, uuid);
drop function if exists import_backup(jsonb);
drop view if exists leaderboard;
drop table if exists rounds;
drop table if exists pair_tallies;
drop table if exists matches;
drop table if exists round_types;
drop table if exists teams;
drop table if exists settings;
drop type if exists match_status;
drop type if exists game_type;

-- ── Enums ────────────────────────────────────────────────────────────────
create type game_type    as enum ('cards', 'domino');
create type match_status as enum ('active', 'finished');

-- ── Per-user settings ────────────────────────────────────────────────────
create table settings (
  user_id              uuid primary key references auth.users on delete cascade,
  theme                text not null default 'auto' check (theme in ('auto','light','dark')),
  cards_sub_rollover   int  not null default 10 check (cards_sub_rollover  >= 2),
  domino_sub_rollover  int  not null default 10 check (domino_sub_rollover >= 2),
  domino_target        int  not null default 151 check (domino_target between 1 and 9999),
  updated_at           timestamptz not null default now()
);

-- ── Teams (separate lists per game) ──────────────────────────────────────
create table teams (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  game       game_type not null,
  name       text not null check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index teams_unique_name on teams (user_id, game, lower(trim(name)));

-- ── Round types (cards only) ─────────────────────────────────────────────
create table round_types (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 30),
  winner_pts  int  not null check (winner_pts < 0),
  loser_pts   int  check (loser_pts is null or loser_pts >= 2),
  is_default  boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create unique index round_types_unique_name on round_types (user_id, lower(trim(name)));
create unique index round_types_one_default on round_types (user_id) where is_default;

-- ── Matches ──────────────────────────────────────────────────────────────
create table matches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  game           game_type not null,
  team1_id       uuid not null references teams on delete cascade,
  team2_id       uuid not null references teams on delete cascade,
  status         match_status not null default 'active',
  target_points  int check (target_points between 1 and 9999),
  winner_team_id uuid references teams on delete cascade,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz,
  check (team1_id <> team2_id),
  check (game = 'domino' or target_points is null)
);
-- At most one live match per game per user.
create unique index matches_one_active on matches (user_id, game) where status = 'active';
create index matches_history on matches (user_id, game, finished_at desc) where status = 'finished';

-- ── Rounds ───────────────────────────────────────────────────────────────
create table rounds (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches on delete cascade,
  position       int  not null,
  t1_points      int  not null,
  t2_points      int  not null,
  winner_team_id uuid not null references teams on delete cascade,
  winner_pts     int,
  note           text not null default '',
  created_at     timestamptz not null default now(),
  unique (match_id, position)
);
create index rounds_by_match on rounds (match_id, position);

-- ── Pair tallies (Main/Sub per unordered team pair) ──────────────────────
-- Normalized so A-vs-B and B-vs-A share one row.
create table pair_tallies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  game         game_type not null,
  low_team_id  uuid not null references teams on delete cascade,
  high_team_id uuid not null references teams on delete cascade,
  low_main     int not null default 0 check (low_main  >= 0),
  low_sub      int not null default 0 check (low_sub   >= 0),
  high_main    int not null default 0 check (high_main >= 0),
  high_sub     int not null default 0 check (high_sub  >= 0),
  check (low_team_id < high_team_id),
  unique (user_id, game, low_team_id, high_team_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table settings     enable row level security;
alter table teams        enable row level security;
alter table round_types  enable row level security;
alter table matches      enable row level security;
alter table pair_tallies enable row level security;
alter table rounds       enable row level security;

create policy "own settings"    on settings     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own teams"       on teams        for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own round types" on round_types  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own matches"     on matches      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tallies"     on pair_tallies for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rounds"      on rounds       for all
  using (exists (select 1 from matches m where m.id = match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from matches m where m.id = match_id and m.user_id = auth.uid()));

-- ── Leaderboard ──────────────────────────────────────────────────────────
-- A view rather than stored counters, so totals can never drift out of sync.
-- security_invoker makes it obey the querying user's RLS policies.
create view leaderboard with (security_invoker = true) as
select
  t.id,
  t.user_id,
  t.game,
  t.name,
  coalesce(sum(case when pt.low_team_id  = t.id then pt.low_main  else 0 end)
         + sum(case when pt.high_team_id = t.id then pt.high_main else 0 end), 0) as main_wins,
  coalesce(sum(case when pt.low_team_id  = t.id then pt.low_sub   else 0 end)
         + sum(case when pt.high_team_id = t.id then pt.high_sub  else 0 end), 0) as sub_wins,
  (select count(*)
     from rounds r
     join matches m on m.id = r.match_id
    where r.winner_team_id = t.id)                                                as rounds_won
from teams t
left join pair_tallies pt
  on pt.user_id = t.user_id
 and pt.game = t.game
 and (pt.low_team_id = t.id or pt.high_team_id = t.id)
group by t.id, t.user_id, t.game, t.name;

-- ── Seed defaults for every new user ─────────────────────────────────────
create or replace function seed_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into settings (user_id) values (new.id);
  insert into round_types (user_id, name, winner_pts, loser_pts, is_default, position) values
    (new.id, 'Normal', -25, null, true,  0),
    (new.id, 'Double', -50, 200,  false, 1);
  return new;
end $$;

create trigger on_user_created
  after insert on auth.users
  for each row execute function seed_new_user();

-- ── Declare a winner ─────────────────────────────────────────────────────
-- Archives the match and credits the winner's pair tally (+1 Sub, rolling
-- into +1 Main at the configured threshold) as a single atomic write, so a
-- partial failure can never archive a match without crediting the tally.
create or replace function declare_winner(p_match_id uuid, p_winner_team_id uuid)
returns matches
language plpgsql security invoker set search_path = public as $$
declare
  v_match     matches;
  v_low       uuid;
  v_high      uuid;
  v_rollover  int;
begin
  select * into v_match from matches
    where id = p_match_id and status = 'active' and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'Match not found or already finished';
  end if;

  if p_winner_team_id not in (v_match.team1_id, v_match.team2_id) then
    raise exception 'Winner must be one of the match teams';
  end if;

  v_low  := least(v_match.team1_id, v_match.team2_id);
  v_high := greatest(v_match.team1_id, v_match.team2_id);

  select case when v_match.game = 'cards' then cards_sub_rollover else domino_sub_rollover end
    into v_rollover
    from settings where user_id = auth.uid();
  v_rollover := coalesce(v_rollover, 10);

  insert into pair_tallies (user_id, game, low_team_id, high_team_id)
  values (auth.uid(), v_match.game, v_low, v_high)
  on conflict (user_id, game, low_team_id, high_team_id) do nothing;

  if p_winner_team_id = v_low then
    update pair_tallies set
      low_sub  = case when low_sub + 1 >= v_rollover then 0 else low_sub + 1 end,
      low_main = case when low_sub + 1 >= v_rollover then low_main + 1 else low_main end
    where user_id = auth.uid() and game = v_match.game
      and low_team_id = v_low and high_team_id = v_high;
  else
    update pair_tallies set
      high_sub  = case when high_sub + 1 >= v_rollover then 0 else high_sub + 1 end,
      high_main = case when high_sub + 1 >= v_rollover then high_main + 1 else high_main end
    where user_id = auth.uid() and game = v_match.game
      and low_team_id = v_low and high_team_id = v_high;
  end if;

  update matches
    set status = 'finished', winner_team_id = p_winner_team_id, finished_at = now()
    where id = p_match_id
    returning * into v_match;

  return v_match;
end;
$$;

-- ── Import a backup ──────────────────────────────────────────────────────
-- Replaces every row this user owns with the contents of p_payload, as one
-- atomic write, so a partial failure can never leave the account half
-- imported. p_payload is already normalized to the *new* shape by
-- src/lib/migrate.ts — this function does not know about the old
-- localStorage key format, only about teams/round_types/matches/rounds/
-- pair_tallies/settings.
--
-- Expected shape:
-- {
--   "settings": { "cards_sub_rollover": 10, "domino_sub_rollover": 10, "domino_target": 151 },
--   "teams": [ { "ref": "cards:Alpha", "game": "cards", "name": "Alpha" }, ... ],
--   "round_types": [ { "name": "Normal", "winner_pts": -25, "loser_pts": null, "is_default": true, "position": 0 }, ... ],
--   "pair_tallies": [ { "game": "cards", "low_ref": "cards:Alpha", "high_ref": "cards:Bravo", "low_main": 1, "low_sub": 2, "high_main": 0, "high_sub": 0 }, ... ],
--   "matches": [
--     {
--       "game": "cards", "status": "finished", "team1_ref": "cards:Alpha", "team2_ref": "cards:Bravo",
--       "target_points": null, "winner_ref": "cards:Alpha", "finished_at": "2026-01-01T00:00:00Z",
--       "rounds": [ { "position": 0, "t1_points": -25, "t2_points": 40, "winner_ref": "cards:Alpha", "winner_pts": -25, "note": "" }, ... ]
--     }, ...
--   ]
-- }
--
-- Team/round references inside the payload are arbitrary string keys chosen
-- by the caller (a "ref"), scoped to this call only — they let matches and
-- tallies point at teams without knowing real ids up front, since teams are
-- inserted fresh by this function and get new generated ids every import.
create or replace function import_backup(p_payload jsonb)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_team_ids       jsonb := '{}'::jsonb;  -- ref -> team id, accumulated as teams are inserted
  v_team           jsonb;
  v_round_type     jsonb;
  v_tally          jsonb;
  v_match          jsonb;
  v_round          jsonb;
  v_new_team_id    uuid;
  v_new_match_id   uuid;
  v_low_ref        text;
  v_high_ref       text;
  v_low_id         uuid;
  v_high_id        uuid;
  v_winner_ref     text;
begin
  -- Wipe everything this user owns. Rounds and pair_tallies cascade from
  -- teams/matches via their foreign keys, so deleting teams, matches and
  -- round_types is enough; settings is updated in place below.
  delete from matches     where user_id = auth.uid();
  delete from teams       where user_id = auth.uid();
  delete from round_types where user_id = auth.uid();

  -- ── Teams ────────────────────────────────────────────────────────────
  for v_team in select * from jsonb_array_elements(coalesce(p_payload->'teams', '[]'::jsonb))
  loop
    insert into teams (user_id, game, name)
    values (auth.uid(), (v_team->>'game')::game_type, v_team->>'name')
    returning id into v_new_team_id;

    v_team_ids := jsonb_set(v_team_ids, array[v_team->>'ref'], to_jsonb(v_new_team_id::text));
  end loop;

  -- ── Round types (cards only) ────────────────────────────────────────
  for v_round_type in select * from jsonb_array_elements(coalesce(p_payload->'round_types', '[]'::jsonb))
  loop
    insert into round_types (user_id, name, winner_pts, loser_pts, is_default, position)
    values (
      auth.uid(),
      v_round_type->>'name',
      (v_round_type->>'winner_pts')::int,
      nullif(v_round_type->>'loser_pts', 'null')::int,
      coalesce((v_round_type->>'is_default')::boolean, false),
      coalesce((v_round_type->>'position')::int, 0)
    );
  end loop;

  -- ── Pair tallies ─────────────────────────────────────────────────────
  for v_tally in select * from jsonb_array_elements(coalesce(p_payload->'pair_tallies', '[]'::jsonb))
  loop
    v_low_ref  := v_tally->>'low_ref';
    v_high_ref := v_tally->>'high_ref';
    v_low_id   := (v_team_ids->>v_low_ref)::uuid;
    v_high_id  := (v_team_ids->>v_high_ref)::uuid;

    -- Referenced teams may have been dropped from the payload (e.g. a team
    -- that no longer exists in the source data); skip rather than fail.
    continue when v_low_id is null or v_high_id is null;

    insert into pair_tallies (
      user_id, game, low_team_id, high_team_id, low_main, low_sub, high_main, high_sub
    ) values (
      auth.uid(),
      (v_tally->>'game')::game_type,
      least(v_low_id, v_high_id),
      greatest(v_low_id, v_high_id),
      case when v_low_id < v_high_id then (v_tally->>'low_main')::int  else (v_tally->>'high_main')::int end,
      case when v_low_id < v_high_id then (v_tally->>'low_sub')::int   else (v_tally->>'high_sub')::int  end,
      case when v_low_id < v_high_id then (v_tally->>'high_main')::int else (v_tally->>'low_main')::int  end,
      case when v_low_id < v_high_id then (v_tally->>'high_sub')::int  else (v_tally->>'low_sub')::int   end
    )
    on conflict (user_id, game, low_team_id, high_team_id) do update set
      low_main  = excluded.low_main,
      low_sub   = excluded.low_sub,
      high_main = excluded.high_main,
      high_sub  = excluded.high_sub;
  end loop;

  -- ── Matches + rounds ─────────────────────────────────────────────────
  for v_match in select * from jsonb_array_elements(coalesce(p_payload->'matches', '[]'::jsonb))
  loop
    -- A match referencing a team missing from the payload can't be inserted
    -- (team1_id/team2_id are not-null); skip it rather than abort the import.
    continue when (v_team_ids->>(v_match->>'team1_ref')) is null
               or (v_team_ids->>(v_match->>'team2_ref')) is null;

    v_winner_ref := v_match->>'winner_ref';

    insert into matches (
      user_id, game, team1_id, team2_id, status, target_points, winner_team_id, finished_at
    ) values (
      auth.uid(),
      (v_match->>'game')::game_type,
      (v_team_ids->>(v_match->>'team1_ref'))::uuid,
      (v_team_ids->>(v_match->>'team2_ref'))::uuid,
      (v_match->>'status')::match_status,
      nullif(v_match->>'target_points', 'null')::int,
      case when v_winner_ref is null then null else (v_team_ids->>v_winner_ref)::uuid end,
      nullif(v_match->>'finished_at', 'null')::timestamptz
    )
    returning id into v_new_match_id;

    for v_round in select * from jsonb_array_elements(coalesce(v_match->'rounds', '[]'::jsonb))
    loop
      continue when (v_team_ids->>(v_round->>'winner_ref')) is null;

      insert into rounds (
        match_id, position, t1_points, t2_points, winner_team_id, winner_pts, note
      ) values (
        v_new_match_id,
        (v_round->>'position')::int,
        (v_round->>'t1_points')::int,
        (v_round->>'t2_points')::int,
        (v_team_ids->>(v_round->>'winner_ref'))::uuid,
        nullif(v_round->>'winner_pts', 'null')::int,
        coalesce(v_round->>'note', '')
      );
    end loop;
  end loop;

  -- ── Settings ─────────────────────────────────────────────────────────
  if p_payload ? 'settings' then
    update settings set
      cards_sub_rollover  = coalesce((p_payload->'settings'->>'cards_sub_rollover')::int,  cards_sub_rollover),
      domino_sub_rollover = coalesce((p_payload->'settings'->>'domino_sub_rollover')::int, domino_sub_rollover),
      domino_target       = coalesce((p_payload->'settings'->>'domino_target')::int,       domino_target),
      updated_at           = now()
    where user_id = auth.uid();
  end if;
end;
$$;

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Lets clients subscribe to postgres_changes on these tables. RLS still
-- applies per-subscriber, so a user only ever receives change events for
-- rows their own policies would let them select.
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table matches;
