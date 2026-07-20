-- Score Keeper: initial schema
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.

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
