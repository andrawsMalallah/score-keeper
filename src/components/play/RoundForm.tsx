'use client'

import { useRef, useState } from 'react'
import type { GameConfig } from '@/lib/game/config'
import { scoreCardsRound, scoreDominoRound, type Slot } from '@/lib/game/scoring'
import { defaultRoundTypeId } from '@/lib/game/roundTypes'
import { useRoundTypes, type RoundType } from '@/hooks/useRoundTypes'
import { useAddRound } from '@/hooks/useRounds'
import type { Match } from '@/hooks/useMatch'
import { toast } from '@/stores/toasts'
import { vibrate } from '@/lib/haptics'
import { Button } from '@/components/ui/Button'

interface RoundFormProps {
  match: Match
  config: GameConfig
  team1Name: string
  team2Name: string
}

/**
 * Entry for one round, shared by both games. What differs is config-driven:
 * cards shows round-type pills and requires at least 2 loser points, domino
 * shows neither and allows 0.
 */
export function RoundForm({
  match,
  config,
  team1Name,
  team2Name,
}: RoundFormProps) {
  const addRound = useAddRound()
  const { data: roundTypes } = useRoundTypes()

  const [winner, setWinner] = useState<Slot | null>(null)
  const [roundTypeId, setRoundTypeId] = useState<string | null>(null)
  const [loserPoints, setLoserPoints] = useState('')
  const [note, setNote] = useState('')

  const pointsInputRef = useRef<HTMLInputElement>(null)

  const selectedType: RoundType | undefined = config.usesRoundTypes
    ? roundTypes?.find(
        (type) => type.id === (roundTypeId ?? defaultRoundTypeId(roundTypes)),
      )
    : undefined

  // A round type carrying fixed loser points locks the input and fills it in.
  const lockedLoserPoints = selectedType?.loser_pts ?? null

  function selectWinner(slot: Slot) {
    setWinner(slot)
    vibrate('selection')
    // Picking a winner focuses the points input (§2.4) so scoring a round is
    // two taps and a number without reaching for the field.
    if (lockedLoserPoints === null) pointsInputRef.current?.focus()
  }

  function handleSubmit() {
    if (!winner) {
      toast.error('Pick which team won the round.')
      return
    }

    if (config.usesRoundTypes && !selectedType) {
      toast.error('Pick a round type.')
      return
    }

    const points = lockedLoserPoints ?? Number(loserPoints)
    if (loserPoints.trim() === '' && lockedLoserPoints === null) {
      toast.error(
        config.minLoserPoints > 0
          ? `Enter the loser's hand points (${config.minLoserPoints} or more).`
          : "Enter the loser's hand points.",
      )
      return
    }
    if (!Number.isInteger(points) || points < config.minLoserPoints) {
      toast.error(
        `Loser's points must be ${config.minLoserPoints} or more.`,
      )
      return
    }

    // The two games score a round completely differently; both live in
    // lib/game/scoring so no component decides who gets what.
    const totals =
      config.usesRoundTypes && selectedType
        ? scoreCardsRound(winner, selectedType.winner_pts, points)
        : scoreDominoRound(winner, points)

    addRound.mutate({
      matchId: match.id,
      t1Points: totals.team1,
      t2Points: totals.team2,
      winnerTeamId: winner === 'team1' ? match.team1_id : match.team2_id,
      winnerPts: selectedType?.winner_pts ?? null,
      note: note.trim(),
    })

    vibrate('roundAdded')

    // Reset for the next round, snapping the type back to the default (§2.3).
    setWinner(null)
    setLoserPoints('')
    setNote('')
    setRoundTypeId(null)
  }

  return (
    <div className="space-y-4 rounded-xl border border-felt-700 bg-felt-800 p-4">
      <fieldset>
        <legend className="text-xs font-semibold tracking-wide text-bone-dim uppercase">
          Round winner
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <WinnerButton
            name={team1Name}
            selected={winner === 'team1'}
            accent="brass"
            onClick={() => selectWinner('team1')}
          />
          <WinnerButton
            name={team2Name}
            selected={winner === 'team2'}
            accent="porcelain"
            onClick={() => selectWinner('team2')}
          />
        </div>
      </fieldset>

      {config.usesRoundTypes && roundTypes && roundTypes.length > 0 && (
        <fieldset>
          <legend className="text-xs font-semibold tracking-wide text-bone-dim uppercase">
            Round type
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {roundTypes.map((type) => {
              const isSelected = selectedType?.id === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setRoundTypeId(type.id)
                    vibrate('selection')
                  }}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? 'rounded-full bg-brass px-3 py-1.5 text-xs font-semibold text-ink'
                      : 'rounded-full border border-felt-700 px-3 py-1.5 text-xs text-bone-dim hover:text-bone'
                  }
                >
                  {type.name}
                  <span className="numerals ml-1.5 opacity-70">
                    {type.winner_pts}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="loser-points" className="text-sm text-bone">
            Loser&rsquo;s hand points
          </label>
          <input
            id="loser-points"
            ref={pointsInputRef}
            type="number"
            inputMode="numeric"
            min={config.minLoserPoints}
            value={lockedLoserPoints ?? loserPoints}
            disabled={lockedLoserPoints !== null}
            onChange={(event) => setLoserPoints(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
            className="numerals mt-1 w-full rounded-lg border border-felt-700 bg-felt-900 px-3 py-2 text-sm text-bone disabled:opacity-60"
          />
          {lockedLoserPoints !== null && (
            <p className="mt-1 text-xs text-bone-dim">
              Fixed by the {selectedType?.name} round type.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="round-note" className="text-sm text-bone">
            Note <span className="text-bone-dim">(optional)</span>
          </label>
          <input
            id="round-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-felt-700 bg-felt-900 px-3 py-2 text-sm text-bone"
          />
        </div>
      </div>

      <Button variant="primary" onClick={handleSubmit} className="w-full">
        Add round
      </Button>
    </div>
  )
}

function WinnerButton({
  name,
  selected,
  accent,
  onClick,
}: {
  name: string
  selected: boolean
  accent: 'brass' | 'porcelain'
  onClick: () => void
}) {
  const selectedStyle =
    accent === 'brass'
      ? 'border-brass bg-brass text-ink'
      : 'border-porcelain bg-porcelain text-ink'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`truncate rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${
        selected
          ? selectedStyle
          : 'border-felt-700 bg-felt-900 text-bone hover:border-bone-dim'
      }`}
    >
      {name}
    </button>
  )
}
