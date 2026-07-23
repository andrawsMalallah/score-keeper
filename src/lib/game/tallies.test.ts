import { describe, expect, it } from 'vitest'

import type { LeaderboardRow, PairTally } from '@/lib/supabase/types'
import {
  applyMatchWin,
  DEFAULT_POINTS_ROLLOVER,
  normalizePair,
  rankBadge,
  readTally,
  sortLeaderboard,
  tallySideFor,
} from './tallies'

// Ordered so that ALPHA < BRAVO < CHARLIE as strings, matching the
// low_team_id < high_team_id check constraint on pair_tallies.
const ALPHA = '11111111-1111-1111-1111-111111111111'
const BRAVO = '22222222-2222-2222-2222-222222222222'
const CHARLIE = '33333333-3333-3333-3333-333333333333'

function tally(overrides: Partial<PairTally> = {}): PairTally {
  return {
    id: 'tally-1',
    user_id: 'user-1',
    game: 'cards',
    low_team_id: ALPHA,
    high_team_id: BRAVO,
    low_stars: 0,
    low_points: 0,
    high_stars: 0,
    high_points: 0,
    ...overrides,
  }
}

function leaderboardRow(
  name: string,
  star_wins: number,
  point_wins: number,
  rounds_won: number,
): LeaderboardRow {
  return {
    id: `team-${name}`,
    user_id: 'user-1',
    game: 'cards',
    name,
    star_wins,
    point_wins,
    rounds_won,
  }
}

describe('normalizePair', () => {
  it('orders ids the same way regardless of argument order', () => {
    const forward = normalizePair(ALPHA, BRAVO)
    const reverse = normalizePair(BRAVO, ALPHA)
    expect(forward).toEqual(reverse)
    expect(forward).toEqual({ low_team_id: ALPHA, high_team_id: BRAVO })
  })

  it('keeps distinct pairings separate', () => {
    expect(normalizePair(ALPHA, BRAVO)).not.toEqual(normalizePair(ALPHA, CHARLIE))
  })
})

describe('tallySideFor and readTally', () => {
  it('maps each team to its column side', () => {
    const pair = normalizePair(BRAVO, ALPHA)
    expect(tallySideFor(pair, ALPHA)).toBe('low')
    expect(tallySideFor(pair, BRAVO)).toBe('high')
  })

  it('reads each team out of the right columns', () => {
    const row = tally({ low_stars: 2, low_points: 3, high_stars: 1, high_points: 7 })
    expect(readTally(row, ALPHA)).toEqual({ stars: 2, points: 3 })
    expect(readTally(row, BRAVO)).toEqual({ stars: 1, points: 7 })
  })
})

describe('applyMatchWin', () => {
  it('adds a point without rolling over below the threshold', () => {
    expect(applyMatchWin({ stars: 0, points: 0 }, DEFAULT_POINTS_ROLLOVER)).toEqual({
      stars: 0,
      points: 1,
      rolledOver: false,
    })
  })

  it('converts points into a star once the threshold is reached', () => {
    expect(applyMatchWin({ stars: 1, points: 9 }, 10)).toEqual({
      stars: 2,
      points: 0,
      rolledOver: true,
    })
  })

  it('rolls over at the minimum threshold of 2', () => {
    expect(applyMatchWin({ stars: 0, points: 1 }, 2)).toEqual({
      stars: 1,
      points: 0,
      rolledOver: true,
    })
  })

  it('treats a below-minimum rollover as 2 rather than minting every win', () => {
    // The database rejects rollover < 2; this keeps a bad client value from
    // producing a star on every single match win.
    expect(applyMatchWin({ stars: 0, points: 0 }, 1)).toEqual({
      stars: 0,
      points: 1,
      rolledOver: false,
    })
  })

  it('recovers if stored points already exceeds a lowered threshold', () => {
    // Lowering the rollover setting can strand a tally above the new threshold.
    expect(applyMatchWin({ stars: 0, points: 8 }, 3)).toEqual({
      stars: 1,
      points: 0,
      rolledOver: true,
    })
  })
})

describe('sortLeaderboard', () => {
  it('orders by stars, then points, then rounds won', () => {
    const rows = [
      leaderboardRow('Charlie', 1, 5, 20),
      leaderboardRow('Alpha', 3, 0, 1),
      leaderboardRow('Delta', 1, 5, 40),
      leaderboardRow('Bravo', 1, 9, 2),
    ]
    expect(sortLeaderboard(rows).map((row) => row.name)).toEqual([
      'Alpha',
      'Bravo',
      'Delta',
      'Charlie',
    ])
  })

  it('does not mutate the array it was given', () => {
    const rows = [leaderboardRow('Alpha', 0, 0, 0), leaderboardRow('Bravo', 5, 0, 0)]
    const originalOrder = rows.map((row) => row.name)
    sortLeaderboard(rows)
    expect(rows.map((row) => row.name)).toEqual(originalOrder)
  })
})

describe('rankBadge', () => {
  it('medals the top three and numbers the rest', () => {
    expect(rankBadge(0)).toBe('🥇')
    expect(rankBadge(2)).toBe('🥉')
    expect(rankBadge(3)).toBe('4')
  })
})
