'use client'

import { useState } from 'react'
import type { GameType } from '@/lib/supabase/types'
import { readTally } from '@/lib/game/tallies'
import { usePairTally, useResetPairTally } from '@/hooks/usePairTally'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface PairTallyRailProps {
  game: GameType
  team1Id: string
  team2Id: string
  team1Name: string
  team2Name: string
}

/**
 * "Overall Score" rail (§2.6): Main/Sub for the active match's team pair.
 * Scoped to this pair only — Alpha-vs-Bravo and Alpha-vs-Charlie tallies never
 * mix, since pair_tallies keys on both team ids.
 */
export function PairTallyRail({
  game,
  team1Id,
  team2Id,
  team1Name,
  team2Name,
}: PairTallyRailProps) {
  const { data: tally, isPending } = usePairTally(game, team1Id, team2Id)
  const resetTally = useResetPairTally(game, team1Id, team2Id)
  const [confirmReset, setConfirmReset] = useState(false)

  if (isPending) return null

  const team1Scores = tally
    ? readTally(tally, team1Id)
    : { main: 0, sub: 0 }
  const team2Scores = tally
    ? readTally(tally, team2Id)
    : { main: 0, sub: 0 }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold tracking-wide text-muted uppercase">
          Overall score
        </h2>
        <Button variant="ghost" onClick={() => setConfirmReset(true)}>
          Reset
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 divide-x divide-border">
        <TallyColumn
          name={team1Name}
          accentClass="text-team1"
          scores={team1Scores}
        />
        <TallyColumn
          name={team2Name}
          accentClass="text-team2"
          scores={team2Scores}
        />
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset counters?"
        body={`Main and Sub for ${team1Name} vs ${team2Name} both go back to 0. This does not affect match history or the leaderboard's rounds-won count.`}
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetTally.mutate()
          setConfirmReset(false)
        }}
      />
    </div>
  )
}

function TallyColumn({
  name,
  accentClass,
  scores,
}: {
  name: string
  accentClass: string
  scores: { main: number; sub: number }
}) {
  return (
    <div className="px-3 text-center first:pl-0 last:pr-0">
      <p className={`truncate text-sm font-semibold ${accentClass}`}>{name}</p>
      <div className="mt-2 flex justify-center gap-4">
        <Stat label="Main" value={scores.main} />
        <Stat label="Sub" value={scores.sub} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="numerals text-xl leading-none font-bold text-fg">{value}</p>
      <p className="mt-1 text-[10px] tracking-wide text-muted uppercase">
        {label}
      </p>
    </div>
  )
}
