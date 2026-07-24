'use client'

import type { GameType } from '@/lib/supabase/types'
import { readTally } from '@/lib/game/tallies'
import { useAllPairTallies } from '@/hooks/usePairTally'
import { useTeams } from '@/hooks/useTeams'

/**
 * Stars/Points for every team pair that has played (§2.6), so standings
 * between two teams can be checked from the setup screen without starting a
 * match to see PairTallyRail. Only pairs with a pair_tallies row are listed —
 * a pair that has never played has no meaningful score to show.
 */
export function PairTallies({ game }: { game: GameType }) {
  const { data: tallies, isPending: talliesPending } = useAllPairTallies(game)
  const { data: teams, isPending: teamsPending } = useTeams(game)

  if (talliesPending || teamsPending) {
    return <p className="text-sm text-muted">Loading team pairs…</p>
  }

  const teamName = (id: string) =>
    teams?.find((team) => team.id === id)?.name ?? '—'

  const rows = (tallies ?? []).filter(
    (tally) => tally.low_stars || tally.low_points || tally.high_stars || tally.high_points,
  )

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        No matches played yet. Standings between two teams appear here once a
        match is declared.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {rows.map((tally) => {
        const lowName = teamName(tally.low_team_id)
        const highName = teamName(tally.high_team_id)
        const lowScores = readTally(tally, tally.low_team_id)
        const highScores = readTally(tally, tally.high_team_id)

        return (
          <li
            key={tally.id}
            className="rounded-lg border border-border bg-bg px-3 py-2"
          >
            <p className="truncate text-sm font-semibold text-fg">
              {lowName} <span className="text-muted">vs</span> {highName}
            </p>
            <div className="mt-2 grid grid-cols-2 divide-x divide-border">
              <PairSide name={lowName} scores={lowScores} />
              <PairSide name={highName} scores={highScores} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function PairSide({
  name,
  scores,
}: {
  name: string
  scores: { stars: number; points: number }
}) {
  return (
    <div className="px-3 text-center first:pl-0 last:pr-0">
      <p className="truncate text-xs text-muted">{name}</p>
      <div className="mt-1 flex items-baseline justify-center gap-3">
        <span>
          <span className="numerals text-xl leading-none font-bold text-fg">
            {scores.stars}
          </span>{' '}
          <span className="text-[10px] tracking-wide text-muted uppercase">
            stars
          </span>
        </span>
        <span>
          <span className="numerals text-sm leading-none font-semibold text-fg">
            {scores.points}
          </span>{' '}
          <span className="text-[10px] tracking-wide text-muted uppercase">
            pts
          </span>
        </span>
      </div>
    </div>
  )
}
