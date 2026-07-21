'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GameType } from '@/lib/supabase/types'
import { getGameConfig } from '@/lib/game/config'
import {
  canDeclareWinner,
  leaderTotal,
  leadingSlot,
  margin,
  sumTotals,
} from '@/lib/game/scoring'
import {
  useAbandonMatch,
  useActiveMatch,
  useDeclareWinner,
  useStartMatch,
} from '@/hooks/useMatch'
import { useRounds } from '@/hooks/useRounds'
import { useTeams } from '@/hooks/useTeams'
import { toast } from '@/stores/toasts'
import { vibrate } from '@/lib/haptics'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PairTallyRail } from './PairTallyRail'
import { RoundForm } from './RoundForm'
import { ScoreStrip } from './ScoreStrip'
import { ProgressBar, TotalsFooter } from './ProgressBar'
import { VictoryModal, type VictoryData } from './VictoryModal'

export function PlayScreen({ game }: { game: GameType }) {
  const router = useRouter()
  const config = getGameConfig(game)

  const { data: match, isPending: matchPending } = useActiveMatch(game)
  const { data: rounds } = useRounds(match?.id)
  const { data: teams } = useTeams(game)
  const abandonMatch = useAbandonMatch(game)
  const declareWinner = useDeclareWinner(game)
  const startMatch = useStartMatch(game)

  const [confirmEnd, setConfirmEnd] = useState(false)
  const [victory, setVictory] = useState<VictoryData | null>(null)

  // No live match means the user reloaded after finishing or abandoning one;
  // setup is the only meaningful place to be. Suppressed while the victory
  // modal is up: declaring clears the active match before the modal closes,
  // and the redirect would otherwise fire out from under it.
  useEffect(() => {
    if (!matchPending && !match && !victory) router.replace(`/${game}`)
  }, [matchPending, match, victory, router, game])

  function startNewMatch(finished: VictoryData) {
    // Clear victory only once the new match is in the cache, not before —
    // clearing it first left a tick where match and victory were both empty,
    // and the redirect effect above sent the user back to setup instead of
    // straight into the fresh match (§2.4/§2.5 promise "immediately").
    startMatch.mutate(
      {
        team1Id: finished.team1Id,
        team2Id: finished.team2Id,
        targetPoints: finished.targetPoints,
      },
      { onSuccess: () => setVictory(null) },
    )
  }

  if (matchPending) {
    return <p className="text-sm text-muted">Loading match…</p>
  }

  if (!match) {
    return victory ? (
      <VictoryModal data={victory} onStartNewMatch={() => startNewMatch(victory)} />
    ) : null
  }

  const teamName = (id: string) =>
    teams?.find((team) => team.id === id)?.name ?? '—'
  const team1Name = teamName(match.team1_id)
  const team2Name = teamName(match.team2_id)

  const roundList = rounds ?? []
  const totals = sumTotals(roundList)
  const canDeclare = canDeclareWinner(roundList, config, match.target_points)

  function handleDeclareWinner() {
    if (!match) return
    const leader = leadingSlot(totals, config)
    if (leader === null) {
      toast.error('Scores are tied — cannot declare a winner yet.')
      return
    }

    const winnerTeamId = leader === 'team1' ? match.team1_id : match.team2_id
    const winnerName = leader === 'team1' ? team1Name : team2Name

    declareWinner.mutate(
      { matchId: match.id, winnerTeamId },
      {
        onSuccess: () => {
          vibrate('victory')
          setVictory({
            winnerName,
            winnerAccent: leader === 'team1' ? 'accent' : 'accent-secondary',
            rounds: roundList.length,
            totalScore: leaderTotal(totals, config),
            margin: margin(totals),
            team1Id: match.team1_id,
            team2Id: match.team2_id,
            targetPoints: match.target_points,
          })
        },
      },
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold text-fg">
          <span className="text-accent">{team1Name}</span>
          <span className="mx-2 text-muted">vs</span>
          <span className="text-accent-secondary">{team2Name}</span>
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

      <PairTallyRail
        game={game}
        team1Id={match.team1_id}
        team2Id={match.team2_id}
        team1Name={team1Name}
        team2Name={team2Name}
      />

      <RoundForm
        match={match}
        config={config}
        team1Name={team1Name}
        team2Name={team2Name}
      />

      <Button
        variant="primary"
        className="w-full"
        disabled={!canDeclare}
        onClick={handleDeclareWinner}
      >
        Declare a Winner
      </Button>

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

      <VictoryModal
        data={victory}
        onStartNewMatch={() => victory && startNewMatch(victory)}
      />
    </div>
  )
}
