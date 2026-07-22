'use client'

import type { GameConfig } from '@/lib/game/config'
import {
  leadingSlot,
  margin,
  momentumPercent,
  pointsNeeded,
  targetPercent,
  sumTotals,
  type Totals,
} from '@/lib/game/scoring'

/**
 * The thin two-tone strip above the controls (§6.4): team1's colour from the
 * left, team2's from the right, meeting at the momentum point — a tug-of-war
 * rope rather than a progress bar.
 *
 * Which measure it shows is config-driven: cards has no target, so it shows
 * relative momentum; domino shows progress toward the target.
 */
export function ProgressBar({
  totals,
  config,
  target,
}: {
  totals: Totals
  config: GameConfig
  target: number | null
}) {
  const percent =
    config.usesTarget && target
      ? targetPercent(totals, target)
      : momentumPercent(totals, config)

  const label =
    config.usesTarget && target
      ? `Progress to ${target}: ${Math.round(percent)}%`
      : `Momentum: ${Math.round(percent)}% toward team one`

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative h-1 w-full overflow-hidden rounded-full bg-team2"
    >
      <div
        className="h-full bg-team1 transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/**
 * Totals summary under the strip. Cards reports who leads and by how much;
 * domino reports how far each team still is from the target.
 */
export function TotalsFooter({
  rounds,
  config,
  target,
  team1Name,
  team2Name,
}: {
  rounds: readonly { t1_points: number; t2_points: number }[]
  config: GameConfig
  target: number | null
  team1Name: string
  team2Name: string
}) {
  const totals = sumTotals(rounds)
  const leader = leadingSlot(totals, config)

  if (config.usesTarget && target) {
    const needed = {
      team1: pointsNeeded(totals.team1, target),
      team2: pointsNeeded(totals.team2, target),
    }
    return (
      // Announced politely so a screen reader hears the score change without
      // interrupting whatever it is currently reading.
      <div aria-live="polite" className="grid grid-cols-2 gap-3 text-sm">
        <NeedsCell name={team1Name} needed={needed.team1} />
        <NeedsCell name={team2Name} needed={needed.team2} />
      </div>
    )
  }

  return (
    <p aria-live="polite" className="text-sm text-muted">
      {leader === null ? (
        'Scores are tied'
      ) : (
        <>
          <span className="font-semibold text-fg">
            {leader === 'team1' ? team1Name : team2Name}
          </span>{' '}
          leads by <span className="numerals">{margin(totals)}</span>
        </>
      )}
    </p>
  )
}

function NeedsCell({ name, needed }: { name: string; needed: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg px-3 py-2">
      <p className="truncate text-xs text-muted">{name}</p>
      {needed === 0 ? (
        <p className="text-sm font-semibold text-accent">✓ Target reached</p>
      ) : (
        <p className="text-sm text-fg">
          needs <span className="numerals font-semibold">{needed}</span>
        </p>
      )}
    </div>
  )
}
