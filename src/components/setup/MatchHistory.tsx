'use client'

import { useState } from 'react'
import type { GameType } from '@/lib/supabase/types'
import { margin, sumTotals } from '@/lib/game/scoring'
import { useTeams } from '@/hooks/useTeams'
import {
  useClearMatchHistory,
  useMatchHistory,
  type MatchHistoryEntry,
} from '@/hooks/useMatchHistory'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SetupSection } from './SetupSection'

const PREVIEW_COUNT = 3

/**
 * Archived matches for a game (§2.8): newest first, capped, with Clear.
 * Renders its own card and disappears entirely once matches are known to be
 * empty — the other setup sections always show their card, but history's
 * card is hidden per spec rather than showing empty-state copy.
 */
export function MatchHistory({ game }: { game: GameType }) {
  const { data: matches, isPending } = useMatchHistory(game)
  const { data: teams } = useTeams(game)
  const clearHistory = useClearMatchHistory(game)
  const [showAll, setShowAll] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  if (isPending) return null
  if (!matches || matches.length === 0) return null

  const teamName = (id: string) =>
    teams?.find((team) => team.id === id)?.name ?? '—'

  const visible = showAll ? matches : matches.slice(0, PREVIEW_COUNT)

  return (
    <SetupSection title="History">
      <div className="space-y-3">
        <ul className="space-y-2">
          {visible.map((match) => (
            <HistoryRow key={match.id} match={match} teamName={teamName} />
          ))}
        </ul>

        <div className="flex items-center justify-between">
          {matches.length > PREVIEW_COUNT ? (
            <Button variant="ghost" onClick={() => setShowAll((value) => !value)}>
              {showAll ? `Show Top ${PREVIEW_COUNT}` : 'Show All'}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" onClick={() => setConfirmClear(true)}>
            Clear
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear match history?"
        body="All archived matches for this game are permanently deleted. Tallies and the leaderboard are unaffected."
        confirmLabel="Clear"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearHistory.mutate()
          setConfirmClear(false)
        }}
      />
    </SetupSection>
  )
}

function HistoryRow({
  match,
  teamName,
}: {
  match: MatchHistoryEntry
  teamName: (id: string) => string
}) {
  const winnerName = match.winner_team_id ? teamName(match.winner_team_id) : '—'
  const date = match.finished_at
    ? new Date(match.finished_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : ''

  const totals = sumTotals(match.rounds)
  const roundCount = match.rounds.length

  return (
    <li className="rounded-lg border border-border bg-bg px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-fg">
          🏆 {winnerName}
        </span>
        <span className="text-xs text-muted">{date}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="numerals">
          {totals.team1} — {totals.team2}
        </span>
        <span>
          Margin {margin(totals)} · {roundCount} round
          {roundCount === 1 ? '' : 's'}
        </span>
      </div>
    </li>
  )
}
