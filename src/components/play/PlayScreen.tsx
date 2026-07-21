'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GameType } from '@/lib/supabase/types'
import { getGameConfig } from '@/lib/game/config'
import { sumTotals } from '@/lib/game/scoring'
import { useAbandonMatch, useActiveMatch } from '@/hooks/useMatch'
import { useRounds } from '@/hooks/useRounds'
import { useTeams } from '@/hooks/useTeams'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RoundForm } from './RoundForm'
import { ScoreStrip } from './ScoreStrip'
import { ProgressBar, TotalsFooter } from './ProgressBar'

export function PlayScreen({ game }: { game: GameType }) {
  const router = useRouter()
  const config = getGameConfig(game)

  const { data: match, isPending: matchPending } = useActiveMatch(game)
  const { data: rounds } = useRounds(match?.id)
  const { data: teams } = useTeams(game)
  const abandonMatch = useAbandonMatch(game)

  const [confirmEnd, setConfirmEnd] = useState(false)

  // No live match means the user reloaded after finishing or abandoning one;
  // setup is the only meaningful place to be.
  useEffect(() => {
    if (!matchPending && !match) router.replace(`/${game}`)
  }, [matchPending, match, router, game])

  if (matchPending) {
    return <p className="text-sm text-bone-dim">Loading match…</p>
  }
  if (!match) return null

  const teamName = (id: string) =>
    teams?.find((team) => team.id === id)?.name ?? '—'
  const team1Name = teamName(match.team1_id)
  const team2Name = teamName(match.team2_id)

  const roundList = rounds ?? []
  const totals = sumTotals(roundList)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold text-bone">
          <span className="text-brass">{team1Name}</span>
          <span className="mx-2 text-bone-dim">vs</span>
          <span className="text-porcelain">{team2Name}</span>
        </h1>

        <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
          End game
        </Button>
      </div>

      <ProgressBar
        totals={totals}
        config={config}
        target={match.target_points}
      />

      <ScoreStrip
        match={match}
        rounds={roundList}
        config={config}
        team1Name={team1Name}
        team2Name={team2Name}
      />

      <TotalsFooter
        rounds={roundList}
        config={config}
        target={match.target_points}
        team1Name={team1Name}
        team2Name={team2Name}
      />

      <RoundForm
        match={match}
        config={config}
        team1Name={team1Name}
        team2Name={team2Name}
      />

      <ConfirmDialog
        open={confirmEnd}
        title="End this game?"
        body="The match is discarded without being saved to history. Tallies and the leaderboard are unaffected."
        confirmLabel="End game"
        destructive
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          abandonMatch.mutate(match.id)
          setConfirmEnd(false)
          router.replace(`/${game}`)
        }}
      />
    </div>
  )
}
