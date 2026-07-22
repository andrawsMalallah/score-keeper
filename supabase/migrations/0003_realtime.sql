-- Score Keeper: enable Realtime on the live-match tables (Phase 8 — REBUILD.md §4.2)
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run, after 0002_import_backup.sql.

-- Lets clients subscribe to postgres_changes on these tables. RLS still
-- applies per-subscriber, so a user only ever receives change events for
-- rows their own policies would let them select.
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table matches;
