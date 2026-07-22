'use client'

import { useState } from 'react'
import type { GameConfig } from '@/lib/game/config'
import { leadingSlot, sumTotals, winnerFromRoundScores } from '@/lib/game/scoring'
import { useDeleteRound, useEditRound, type Round } from '@/hooks/useRounds'
import type { Match } from '@/hooks/useMatch'
import { toast } from '@/stores/toasts'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RoundRow } from './RoundRow'

interface ScoreStripProps {
  match: Match
  rounds: Round[]
  config: GameConfig
  team1Name: string
  team2Name: string
}

/**
 * The rounds table, rendered as a score strip: a raised surface panel with
 * mono numerals and a ruled centre divider.
 */
export function ScoreStrip({
  match,
  rounds,
  config,
  team1Name,
  team2Name,
}: ScoreStripProps) {
  const editRound = useEditRound()
  const deleteRound = useDeleteRound()
  const [pendingDelete, setPendingDelete] = useState<Round | null>(null)

  const totals = sumTotals(rounds)
  const leader = leadingSlot(totals, config)

  function handleEdit(round: Round, t1Points: number, t2Points: number) {
    // An edit can flip who won the round, and which value counts as the win
    // depends on the game — so the winner is recomputed, never assumed.
    const slot = winnerFromRoundScores(
      { t1_points: t1Points, t2_points: t2Points },
      config,
    )

    if (slot === null) {
      toast.error('The two scores are equal. Change one to set a winner.')
      return false
    }

    editRound.mutate({
      matchId: match.id,
      roundId: round.id,
      t1Points,
      t2Points,
      winnerTeamId: slot === 'team1' ? match.team1_id : match.team2_id,
    })
    return true
  }

  return (
    <div className="mx-auto w-full max-w-[560px]">
      {/* The torn top edge of the strip. */}
      <div
        aria-hidden="true"
        className="h-2 bg-surface"
        style={{
          maskImage:
            'radial-gradient(circle at 6px 8px, transparent 5px, black 5px)',
          maskSize: '12px 12px',
          maskRepeat: 'repeat-x',
          WebkitMaskImage:
            'radial-gradient(circle at 6px 8px, transparent 5px, black 5px)',
          WebkitMaskSize: '12px 12px',
          WebkitMaskRepeat: 'repeat-x',
        }}
      />

      <div className="bg-surface px-4 pb-3 text-fg shadow-lg sm:px-5">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">
            Rounds for {team1Name} against {team2Name}
          </caption>
          <thead>
            <tr className="border-b border-fg/20">
              <th scope="col" className="w-8 py-2 text-left text-[11px] font-semibold tracking-wide uppercase opacity-60">
                #
              </th>
              <th scope="col" className="py-2 text-center text-[11px] font-semibold tracking-wide uppercase opacity-60">
                {team1Name}
              </th>
              <th scope="col" className="w-4" aria-hidden="true" />
              <th scope="col" className="py-2 text-center text-[11px] font-semibold tracking-wide uppercase opacity-60">
                {team2Name}
              </th>
              <th scope="col" className="w-16">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {rounds.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm opacity-60">
                  No rounds yet. Add the first one below.
                </td>
              </tr>
            ) : (
              rounds.map((round, index) => (
                <RoundRow
                  key={round.id}
                  round={round}
                  index={index}
                  config={config}
                  onEdit={(t1, t2) => handleEdit(round, t1, t2)}
                  onDelete={() => setPendingDelete(round)}
                />
              ))
            )}
          </tbody>

          {rounds.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-fg/30">
                <th scope="row" className="py-2 text-left text-[11px] font-semibold tracking-wide uppercase opacity-60">
                  Total
                </th>
                <td
                  className={`numerals py-2 text-center text-[28px] leading-none ${leader === 'team1' ? 'font-bold' : 'opacity-70'}`}
                >
                  {totals.team1}
                </td>
                <td aria-hidden="true" />
                <td
                  className={`numerals py-2 text-center text-[28px] leading-none ${leader === 'team2' ? 'font-bold' : 'opacity-70'}`}
                >
                  {totals.team2}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete round ${(rounds.findIndex((r) => r.id === pendingDelete?.id) + 1) || ''}?`}
        body="The totals and rounds-won counts update to match."
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          deleteRound.mutate({ matchId: match.id, roundId: pendingDelete.id })
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
