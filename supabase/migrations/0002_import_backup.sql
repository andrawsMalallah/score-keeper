-- Score Keeper: import_backup RPC (Phase 7 — REBUILD.md §5)
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run, after 0001_init.sql.

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
