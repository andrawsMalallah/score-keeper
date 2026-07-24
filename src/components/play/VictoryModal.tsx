'use client'

import { useEffect, useRef } from 'react'
import { fireConfetti } from '@/lib/confetti'
import { Button } from '@/components/ui/Button'

export interface VictoryData {
  winnerName: string
  winnerTeam: 'team1' | 'team2'
  rounds: number
  totalScore: number
  margin: number
  /** Carried so "Start New Match" can restart with the same teams even after
   *  the finished match has already been cleared from the active-match cache. */
  team1Id: string
  team2Id: string
  targetPoints: number | null
}

interface VictoryModalProps {
  data: VictoryData | null
  onRematch: () => void
  onEndGame: () => void
}

/**
 * The victory moment (§2.9): trophy, winner name, three stat boxes, confetti.
 * `data` is captured by the caller at declare time so the modal keeps showing
 * the finished match's numbers even after the active-match query flips to null.
 */
export function VictoryModal({ data, onRematch, onEndGame }: VictoryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (data && dialog && !dialog.open) {
      dialog.showModal()
      fireConfetti()
    }
  }, [data])

  if (!data) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="victory-modal-title"
      className="w-full max-w-xl rounded-xl border border-border bg-surface p-6 text-center text-fg motion-safe:open:animate-[victory-scale-in_240ms_ease-out] backdrop:bg-black/85"
    >
      <p className="text-4xl" aria-hidden="true">
        🏆
      </p>
      <h2
        id="victory-modal-title"
        className="mt-2 font-display text-2xl font-bold text-fg"
      >
        Victory!
      </h2>
      <p className="mt-1 text-sm text-muted">
        <span className="font-semibold text-fg">{data.winnerName}</span> has
        won the match!
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatBox label="Rounds" value={data.rounds} />
        <StatBox label="Total Score" value={data.totalScore} />
        <StatBox label="Margin" value={data.margin} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            dialogRef.current?.close()
            onEndGame()
          }}
        >
          End Game
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            dialogRef.current?.close()
            onRematch()
          }}
        >
          Rematch
        </Button>
      </div>
    </dialog>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg px-2 py-3">
      <p className="numerals text-xl font-bold text-fg">{value}</p>
      <p className="mt-0.5 text-[10px] tracking-wide text-muted uppercase">
        {label}
      </p>
    </div>
  )
}
