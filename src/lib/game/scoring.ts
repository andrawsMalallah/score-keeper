import type { GameConfig } from './config'

/**
 * The subset of a round this module needs. Deliberately narrower than the
 * database Round row so the scoring logic can be tested without inventing ids,
 * timestamps, or match references.
 */
export interface ScorableRound {
  t1_points: number
  t2_points: number
}

export interface Totals {
  team1: number
  team2: number
}

/** Which side of a match a team sits on. Slots are positional, not identity. */
export type Slot = 'team1' | 'team2'

export function sumTotals(rounds: readonly ScorableRound[]): Totals {
  return rounds.reduce<Totals>(
    (totals, round) => ({
      team1: totals.team1 + round.t1_points,
      team2: totals.team2 + round.t2_points,
    }),
    { team1: 0, team2: 0 },
  )
}

/**
 * The slot currently ahead, or null when tied.
 *
 * "Ahead" flips meaning between the games: in cards the lower total leads, in
 * domino the higher one does. Every leader/winner question in the app routes
 * through here so that comparison direction is written exactly once.
 */
export function leadingSlot(totals: Totals, config: GameConfig): Slot | null {
  if (totals.team1 === totals.team2) return null
  const team1Leads =
    config.winnerIs === 'lower'
      ? totals.team1 < totals.team2
      : totals.team1 > totals.team2
  return team1Leads ? 'team1' : 'team2'
}

/** Absolute point gap between the two totals; 0 when tied. */
export function margin(totals: Totals): number {
  return Math.abs(totals.team1 - totals.team2)
}

/** The leader's total — the figure shown in the victory modal's stat box. */
export function leaderTotal(totals: Totals, config: GameConfig): number {
  const leader = leadingSlot(totals, config)
  if (leader === null) return totals.team1 // tied, so either total is the same
  return totals[leader]
}

/**
 * Score a cards round: the winner takes the round type's negative points and
 * the loser takes the points left in their hand.
 */
export function scoreCardsRound(
  winner: Slot,
  winnerPoints: number,
  loserPoints: number,
): Totals {
  return winner === 'team1'
    ? { team1: winnerPoints, team2: loserPoints }
    : { team1: loserPoints, team2: winnerPoints }
}

/**
 * Score a domino round: the winner collects whatever was left in the loser's
 * hand, and the loser scores nothing.
 */
export function scoreDominoRound(winner: Slot, loserPoints: number): Totals {
  return winner === 'team1'
    ? { team1: loserPoints, team2: 0 }
    : { team1: 0, team2: loserPoints }
}

/**
 * Recompute a round's winner after an inline edit.
 *
 * Editing a score can flip who won the round, which in turn changes lifetime
 * rounds-won counts. Returning null on a tie lets the caller reject the edit
 * rather than silently picking a side.
 */
export function winnerFromRoundScores(
  round: ScorableRound,
  config: GameConfig,
): Slot | null {
  return leadingSlot({ team1: round.t1_points, team2: round.t2_points }, config)
}

/**
 * Whether "Declare a Winner" should be enabled.
 *
 * Cards needs only a round on the board; domino additionally requires someone
 * to have reached the target. A tie is blocked at declare time with an error
 * toast rather than by disabling the button, matching the original app — the
 * user gets told why instead of facing a dead control.
 */
export function canDeclareWinner(
  rounds: readonly ScorableRound[],
  config: GameConfig,
  target?: number | null,
): boolean {
  if (rounds.length === 0) return false
  if (!config.usesTarget) return true
  if (target == null) return false
  const totals = sumTotals(rounds)
  return Math.max(totals.team1, totals.team2) >= target
}

/**
 * Percentage fill for the momentum bar (cards), 0-100 measured from team 1.
 *
 * Clamped to 5-95 so neither team's colour disappears entirely from the bar,
 * and parked at 50 when there is nothing to compare.
 */
export function momentumPercent(totals: Totals, config: GameConfig): number {
  const spread = Math.abs(totals.team1) + Math.abs(totals.team2)
  if (spread === 0 || totals.team1 === totals.team2) return 50

  const leader = leadingSlot(totals, config)
  const share = (margin(totals) / spread) * 50
  const percent = leader === 'team1' ? 50 + share : 50 - share
  return clamp(percent, 5, 95)
}

/**
 * Progress toward the domino target, 0-100.
 *
 * Always driven by the highest total: domino is the only game with a target,
 * and there the highest total is by definition the leader, so this needs no
 * GameConfig to pick a direction.
 */
export function targetPercent(totals: Totals, target: number): number {
  if (target <= 0) return 0
  const best = Math.max(totals.team1, totals.team2)
  return clamp((best / target) * 100, 0, 100)
}

/** Points a team still needs to reach the target; 0 once they are there. */
export function pointsNeeded(total: number, target: number): number {
  return Math.max(0, target - total)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
