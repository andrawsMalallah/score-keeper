import type { LeaderboardRow, PairTally } from '@/lib/supabase/types'

/** Smallest rollover the UI and the database check constraint both allow. */
export const MIN_POINTS_ROLLOVER = 2
export const DEFAULT_POINTS_ROLLOVER = 10

/**
 * A team pair with ids ordered to match the `low_team_id < high_team_id` check
 * constraint on pair_tallies, so A-vs-B and B-vs-A resolve to one row.
 */
export interface NormalizedPair {
  low_team_id: string
  high_team_id: string
}

export function normalizePair(teamA: string, teamB: string): NormalizedPair {
  return teamA < teamB
    ? { low_team_id: teamA, high_team_id: teamB }
    : { low_team_id: teamB, high_team_id: teamA }
}

/** Which column pair a team's scores live in for a given tally row. */
export type TallySide = 'low' | 'high'

export function tallySideFor(pair: NormalizedPair, teamId: string): TallySide {
  return teamId === pair.low_team_id ? 'low' : 'high'
}

export interface TallyScores {
  stars: number
  points: number
}

/** Read one team's stars/points out of a tally row, hiding the low/high columns. */
export function readTally(tally: PairTally, teamId: string): TallyScores {
  return teamId === tally.low_team_id
    ? { stars: tally.low_stars, points: tally.low_points }
    : { stars: tally.high_stars, points: tally.high_points }
}

export interface RolloverResult extends TallyScores {
  /** True when this win pushed points over the threshold and minted a star. */
  rolledOver: boolean
}

/**
 * Apply a match win: +1 point, and when points reaches the rollover threshold
 * it resets to 0 and mints one star.
 *
 * The `rolledOver` flag drives the success toast and its haptic pattern, so it
 * has to come out of the same call that does the arithmetic — recomputing it at
 * the call site is how the original app drifted.
 */
export function applyMatchWin(
  current: TallyScores,
  rollover: number,
): RolloverResult {
  const threshold = Math.max(MIN_POINTS_ROLLOVER, rollover)
  const points = current.points + 1

  if (points >= threshold) {
    return { stars: current.stars + 1, points: 0, rolledOver: true }
  }
  return { stars: current.stars, points, rolledOver: false }
}

/**
 * Leaderboard ordering: stars desc, then points desc, then lifetime rounds won.
 *
 * Returns a new array; callers render straight from query results and must not
 * mutate the cache in place.
 */
export function sortLeaderboard(
  rows: readonly LeaderboardRow[],
): LeaderboardRow[] {
  return [...rows].sort(
    (a, b) =>
      b.star_wins - a.star_wins ||
      b.point_wins - a.point_wins ||
      b.rounds_won - a.rounds_won,
  )
}

/** Medal for the top three places, falling back to the plain rank number. */
export function rankBadge(index: number): string {
  return ['🥇', '🥈', '🥉'][index] ?? String(index + 1)
}
