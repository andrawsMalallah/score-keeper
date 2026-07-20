# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A score keeper for two tabletop games (Cards and Domino) played between two teams. It is
a rewrite of a vanilla HTML/JS app that stored everything in `localStorage`; that original
lives on the `legacy` branch and is still runnable by opening its `index.html`.

`REBUILD.md` in the repo root is the authoritative spec: complete feature parity checklist,
schema rationale, the localStorage-to-Postgres mapping, the phased build plan, and the
design direction. It is gitignored via `.git/info/exclude` (local only, deliberately).
**Read it before adding features** — it describes behavior that no longer exists anywhere
in this codebase, since `main` was cleared before the rewrite.

## Commands

```bash
npm run dev          # dev server on :3000 (Turbopack, default in Next 16)
npm run build        # production build; also typechecks
npm run lint         # eslint (note: bare `eslint`, not `next lint`, which Next 16 removed)
npx tsc --noEmit     # typecheck alone
```

No test runner is installed yet. Phase 3 of the build plan adds Vitest for `src/lib/game/`.

## Next.js 16 gotchas

This project runs Next.js 16, where several conventions changed from what most
documentation (including Supabase's own) still shows:

- **`middleware.ts` is now `proxy.ts`**, with a `proxy` export instead of `middleware`.
  Session refresh lives in `src/proxy.ts`. A file named `middleware.ts` would be silently
  ignored. The proxy runtime is always `nodejs` and cannot be configured.
- `next lint` is gone; the `lint` script calls `eslint` directly.
- Turbopack is the default for both `dev` and `build`.

Verify a build actually registers the proxy — successful output includes a
`ƒ Proxy (Middleware)` line.

## Supabase

Three clients, each for a different execution context. Picking the wrong one fails in
non-obvious ways:

| File | Use in |
|---|---|
| `src/lib/supabase/client.ts` | Client Components (`'use client'`) |
| `src/lib/supabase/server.ts` | Server Components, Route Handlers, Server Actions |
| `src/lib/supabase/proxy.ts` | `src/proxy.ts` only |

The server client's `setAll` swallows errors because Server Components cannot set cookies;
this is safe *only* because the proxy refreshes the session on every request. Don't remove
the proxy's matcher coverage without accounting for that.

Always use `getUser()`, never `getSession()` — the latter trusts unverified cookie data.

### Anonymous sessions

The proxy calls `signInAnonymously()` when no user exists, so a first-time visitor can keep
score immediately without signing up — matching how the original localStorage app behaved.
This requires **Anonymous sign-ins** enabled in the Supabase dashboard (Authentication →
Sign In / Providers); without it every request 422s with `anonymous_provider_disabled`.
Accounts upgrade to email later via `linkIdentity` without losing data.

### Environment

`.env.local` holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(Supabase's newer key naming, not the classic `ANON_KEY`). `.gitignore` excludes `.env*`
but negates `.env.example`, which is committed as the template.

## Database

`supabase/migrations/0001_init.sql` is applied by pasting into the dashboard SQL editor —
the CLI is not set up, so there is no `db push` workflow. Migrations are checked in as the
record of what the live schema should be.

`src/lib/supabase/types.ts` is **hand-written to match the migration**, not generated.
Schema changes must be mirrored there by hand, or regenerated with the CLI command in that
file's header (needs a Supabase access token).

### Schema intent

Understanding these three decisions explains most of the schema:

- **`leaderboard` is a view, not a table.** The original app kept manual counters in
  `localStorage` and incremented/decremented them on every round add, edit, and delete —
  a constant source of drift. Totals are now derived. Never add stored counters back.
- **`pair_tallies` is normalized by team id** (`low_team_id < high_team_id`, enforced by a
  check constraint) so A-vs-B and B-vs-A resolve to one row. The old code did this by
  sorting team *names* into a `"A|||B"` string key, which made renaming a team a ~120-line
  cascade. Referencing ids makes rename a single `update`.
- **One active match per game per user**, enforced by a partial unique index. Match history
  is the same table filtered to `status = 'finished'`.

Every table is under RLS scoped to `auth.uid()`. Constraints encode game rules (winner
points must be negative, loser points ≥ 2 when fixed, a match cannot have the same team
twice), so invalid states are rejected by the database rather than only by the UI.

## Architecture

The single most important structural rule: **Cards and Domino share one route tree and one
component set**, parameterized by a `GameConfig`. The original `app.js` duplicated every
function (`addRound`/`addDominoRound`, two sidebars, two leaderboards, two history
renderers) across 2,000 lines. Divergent behavior belongs in config, not in forked
components.

The two games differ in exactly these ways:

| | Cards | Domino |
|---|---|---|
| Winner | **Lower** total | **Higher** total |
| Round scoring | Winner gets negative round-type points; loser gets hand points | Winner gets loser's hand points; loser gets 0 |
| Min loser points | 2 | 0 |
| Round types | Yes | No |
| Target score | No | Yes (declare blocked until reached) |

Scoring logic belongs in `src/lib/game/` as pure functions, tested independently of any UI.

Score entry happens live at a table, so mutations must feel instant: use optimistic updates
and never block the UI on a network round trip.

## Sub/Main tallies

A scoring concept that is easy to misread: winning a *match* earns the winning team +1
**Sub** in that team pair's tally. When Sub reaches the game's rollover threshold
(configurable per game, minimum 2, default 10), Sub resets to 0 and **Main** increments by
1. Tallies are per team *pair*, so Alpha-vs-Bravo and Alpha-vs-Charlie accumulate
separately, while the leaderboard sums a team's tallies across all its pairs.
