'use client'

import { useState } from 'react'
import type { GameType } from '@/lib/supabase/types'
import { rankBadge } from '@/lib/game/tallies'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { Button } from '@/components/ui/Button'

const PREVIEW_COUNT = 3

/** Standings for a game (§2.7): collapsed to the top three teams until expanded. */
export function Leaderboard({ game }: { game: GameType }) {
  const { data: rows, isPending } = useLeaderboard(game)
  const [showAll, setShowAll] = useState(false)

  if (isPending) {
    return <p className="text-sm text-muted">Loading leaderboard…</p>
  }

  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        No teams saved yet. Add teams above to start a leaderboard.
      </p>
    )
  }

  const visible = showAll ? rows : rows.slice(0, PREVIEW_COUNT)

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {visible.map((row, index) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2"
          >
            <span className="w-6 text-center text-base" aria-hidden="true">
              {rankBadge(index)}
            </span>
            <span className="flex-1 truncate text-sm font-semibold text-fg">
              {row.name}
            </span>
            <span className="numerals text-sm text-muted">
              <span className="font-bold text-fg">{row.main_wins}</span> main
            </span>
            <span className="numerals text-sm text-muted">
              <span className="font-bold text-fg">{row.sub_wins}</span> sub
            </span>
            <span className="numerals text-sm text-muted">
              <span className="font-bold text-fg">{row.rounds_won}</span> rnds
            </span>
          </li>
        ))}
      </ul>

      {rows.length > PREVIEW_COUNT && (
        <Button variant="ghost" onClick={() => setShowAll((value) => !value)}>
          {showAll ? `Show Top ${PREVIEW_COUNT}` : 'Show All'}
        </Button>
      )}
    </div>
  )
}
