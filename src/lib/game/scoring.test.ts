import { describe, expect, it } from 'vitest'

import { GAME_CONFIGS } from './config'
import {
  canDeclareWinner,
  leaderTotal,
  leadingSlot,
  margin,
  momentumPercent,
  pointsNeeded,
  scoreCardsRound,
  scoreDominoRound,
  sumTotals,
  targetPercent,
  winnerFromRoundScores,
  type ScorableRound,
} from './scoring'

const cards = GAME_CONFIGS.cards
const domino = GAME_CONFIGS.domino

/** Terse round builder so the tests read as score pairs, not object literals. */
function round(t1: number, t2: number): ScorableRound {
  return { t1_points: t1, t2_points: t2 }
}

describe('sumTotals', () => {
  it('returns zeroes for an empty match', () => {
    expect(sumTotals([])).toEqual({ team1: 0, team2: 0 })
  })

  it('adds each column independently, including negatives', () => {
    expect(sumTotals([round(-25, 90), round(120, -50)])).toEqual({
      team1: 95,
      team2: 40,
    })
  })
})

describe('leadingSlot', () => {
  it('gives cards to the lower total', () => {
    expect(leadingSlot({ team1: 40, team2: 95 }, cards)).toBe('team1')
    expect(leadingSlot({ team1: 95, team2: 40 }, cards)).toBe('team2')
  })

  it('gives domino to the higher total', () => {
    expect(leadingSlot({ team1: 120, team2: 80 }, domino)).toBe('team1')
    expect(leadingSlot({ team1: 80, team2: 120 }, domino)).toBe('team2')
  })

  it('reports a tie as null in both games', () => {
    expect(leadingSlot({ team1: 50, team2: 50 }, cards)).toBeNull()
    expect(leadingSlot({ team1: 50, team2: 50 }, domino)).toBeNull()
  })

  it('handles negative cards totals, where a deeper negative leads', () => {
    expect(leadingSlot({ team1: -75, team2: -25 }, cards)).toBe('team1')
  })
})

describe('margin and leaderTotal', () => {
  it('measures the gap regardless of direction', () => {
    expect(margin({ team1: 40, team2: 95 })).toBe(55)
    expect(margin({ team1: 95, team2: 40 })).toBe(55)
    expect(margin({ team1: 50, team2: 50 })).toBe(0)
  })

  it('reports the winning total for each game direction', () => {
    expect(leaderTotal({ team1: 40, team2: 95 }, cards)).toBe(40)
    expect(leaderTotal({ team1: 40, team2: 95 }, domino)).toBe(95)
  })
})

describe('round scoring', () => {
  it('gives the cards winner negative points and the loser their hand', () => {
    expect(scoreCardsRound('team1', -25, 90)).toEqual({ team1: -25, team2: 90 })
    expect(scoreCardsRound('team2', -25, 90)).toEqual({ team1: 90, team2: -25 })
  })

  it("gives the domino winner the loser's hand and the loser zero", () => {
    expect(scoreDominoRound('team1', 45)).toEqual({ team1: 45, team2: 0 })
    expect(scoreDominoRound('team2', 45)).toEqual({ team1: 0, team2: 45 })
  })
})

describe('winnerFromRoundScores', () => {
  // Inline edits can flip who won a round, which has to cascade into lifetime
  // rounds-won counts. Getting this backwards was a live bug in the old app.
  it('recomputes the cards winner as the lower value', () => {
    expect(winnerFromRoundScores(round(-25, 90), cards)).toBe('team1')
    expect(winnerFromRoundScores(round(90, -25), cards)).toBe('team2')
  })

  it('recomputes the domino winner as the higher value', () => {
    expect(winnerFromRoundScores(round(45, 0), domino)).toBe('team1')
    expect(winnerFromRoundScores(round(0, 45), domino)).toBe('team2')
  })

  it('returns null when an edit ties the round, so callers can reject it', () => {
    expect(winnerFromRoundScores(round(30, 30), cards)).toBeNull()
    expect(winnerFromRoundScores(round(0, 0), domino)).toBeNull()
  })
})

describe('canDeclareWinner', () => {
  it('stays blocked with no rounds in either game', () => {
    expect(canDeclareWinner([], cards)).toBe(false)
    expect(canDeclareWinner([], domino, 151)).toBe(false)
  })

  it('unlocks for cards as soon as one round exists', () => {
    expect(canDeclareWinner([round(-25, 90)], cards)).toBe(true)
  })

  it('keeps domino blocked until a team reaches the target', () => {
    const rounds = [round(60, 0), round(0, 40)]
    expect(canDeclareWinner(rounds, domino, 151)).toBe(false)
    expect(canDeclareWinner([...rounds, round(91, 0)], domino, 151)).toBe(true)
  })

  it('unlocks domino exactly at the target, not only past it', () => {
    expect(canDeclareWinner([round(151, 0)], domino, 151)).toBe(true)
  })

  it('stays blocked when domino has no target set', () => {
    expect(canDeclareWinner([round(200, 0)], domino, null)).toBe(false)
  })
})

describe('momentumPercent', () => {
  it('sits at the midpoint with no rounds or a tie', () => {
    expect(momentumPercent({ team1: 0, team2: 0 }, cards)).toBe(50)
    expect(momentumPercent({ team1: 50, team2: 50 }, cards)).toBe(50)
  })

  it('pushes past the midpoint toward whoever leads', () => {
    expect(momentumPercent({ team1: 20, team2: 80 }, cards)).toBeGreaterThan(50)
    expect(momentumPercent({ team1: 80, team2: 20 }, cards)).toBeLessThan(50)
  })

  it('leans the opposite way in domino for the same totals', () => {
    expect(momentumPercent({ team1: 20, team2: 80 }, domino)).toBeLessThan(50)
  })

  it('clamps to 5-95 so neither team colour vanishes', () => {
    const lopsided = momentumPercent({ team1: 0, team2: 5000 }, cards)
    expect(lopsided).toBeLessThanOrEqual(95)
    expect(lopsided).toBeGreaterThanOrEqual(5)
  })
})

describe('targetPercent and pointsNeeded', () => {
  it('tracks the highest total toward the target', () => {
    expect(targetPercent({ team1: 75, team2: 30 }, 150)).toBe(50)
  })

  it('caps at 100 once the target is passed', () => {
    expect(targetPercent({ team1: 200, team2: 30 }, 151)).toBe(100)
  })

  it('is 0 before any rounds are played', () => {
    expect(targetPercent({ team1: 0, team2: 0 }, 151)).toBe(0)
  })

  it('counts down the points a team still needs, floored at 0', () => {
    expect(pointsNeeded(120, 151)).toBe(31)
    expect(pointsNeeded(151, 151)).toBe(0)
    expect(pointsNeeded(200, 151)).toBe(0)
  })
})
