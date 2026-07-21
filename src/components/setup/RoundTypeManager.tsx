'use client'

import { useState } from 'react'
import {
  ROUND_TYPE_RULES,
  isDuplicateRoundTypeName,
  useAddRoundType,
  useDeleteRoundType,
  useRoundTypes,
  useSetDefaultRoundType,
  type RoundType,
} from '@/hooks/useRoundTypes'
import { planRoundTypeDeletion } from '@/lib/game/roundTypes'
import { toast } from '@/stores/toasts'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

/**
 * Managed list of cards round types (§2.3). Rendered only for cards, gated by
 * config.usesRoundTypes at the call site.
 */
export function RoundTypeManager() {
  const { data: roundTypes, isPending } = useRoundTypes()
  const addRoundType = useAddRoundType()
  const setDefault = useSetDefaultRoundType()
  const deleteRoundType = useDeleteRoundType()

  const [pendingDelete, setPendingDelete] = useState<RoundType | null>(null)

  function handleDelete(type: RoundType) {
    const plan = planRoundTypeDeletion(roundTypes ?? [], type.id)

    if (plan.refusedBecause === 'last-remaining') {
      toast.error('Keep at least one round type.')
      return
    }
    setPendingDelete(type)
  }

  function confirmDelete() {
    if (!pendingDelete) return

    const plan = planRoundTypeDeletion(roundTypes ?? [], pendingDelete.id)
    // Hand the default to a survivor before removing its holder, so the list is
    // never left without a default for the round form to select.
    if (plan.promoteToDefaultId) {
      setDefault.mutate(plan.promoteToDefaultId)
    }

    deleteRoundType.mutate(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="space-y-4">
      <AddRoundTypeForm
        onAdd={(input) => {
          if (isDuplicateRoundTypeName(roundTypes, input.name)) {
            toast.error(`"${input.name}" already exists.`)
            return false
          }
          addRoundType.mutate(input)
          return true
        }}
      />

      {isPending ? (
        <p className="text-sm text-bone-dim">Loading round types…</p>
      ) : roundTypes && roundTypes.length > 0 ? (
        <ul className="space-y-2">
          {roundTypes.map((type) => (
            <li
              key={type.id}
              className="flex items-center gap-2 rounded-lg border border-felt-700 bg-felt-900 p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-bone">{type.name}</span>
                  {type.is_default && (
                    <span className="shrink-0 rounded-full bg-brass px-2 py-0.5 text-[10px] font-semibold text-ink">
                      Default
                    </span>
                  )}
                </div>
                <p className="numerals mt-0.5 text-xs text-bone-dim">
                  W {type.winner_pts}
                  {type.loser_pts !== null && ` · L ${type.loser_pts}`}
                </p>
              </div>

              {!type.is_default && (
                <Button
                  variant="ghost"
                  onClick={() => setDefault.mutate(type.id)}
                  className="shrink-0 text-xs"
                >
                  Set default
                </Button>
              )}

              <button
                type="button"
                onClick={() => handleDelete(type)}
                aria-label={`Delete ${type.name}`}
                className="shrink-0 rounded px-1 text-xs text-bone-dim hover:text-clay"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-bone-dim">No round types yet.</p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name}?`}
        body={
          pendingDelete?.is_default
            ? 'This is the default round type, so another one will become the default. Rounds already scored keep their points.'
            : 'Rounds already scored with it keep their points.'
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

interface AddInput {
  name: string
  winnerPts: number
  loserPts: number | null
}

/** Returns true when the parent accepted the input, so the form can reset. */
function AddRoundTypeForm({ onAdd }: { onAdd: (input: AddInput) => boolean }) {
  const [name, setName] = useState('')
  const [winnerPts, setWinnerPts] = useState('')
  const [loserPts, setLoserPts] = useState('')

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Enter a name for the round type.')
      return
    }

    // Collected as a positive number and negated on save: "25" reads more
    // naturally than "-25" when describing what a win is worth.
    const winner = Number(winnerPts)
    if (!Number.isInteger(winner) || winner <= 0) {
      toast.error("Enter the winner's points as a positive number.")
      return
    }

    const hasLoser = loserPts.trim() !== ''
    const loser = Number(loserPts)
    if (hasLoser && (!Number.isInteger(loser) || loser < ROUND_TYPE_RULES.minLoserPts)) {
      toast.error(
        `Fixed loser points must be ${ROUND_TYPE_RULES.minLoserPts} or more.`,
      )
      return
    }

    const accepted = onAdd({
      name: trimmed,
      winnerPts: -winner,
      loserPts: hasLoser ? loser : null,
    })

    if (accepted) {
      setName('')
      setWinnerPts('')
      setLoserPts('')
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="rt-name" className="sr-only">
          Round type name
        </label>
        <input
          id="rt-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          maxLength={ROUND_TYPE_RULES.nameMaxLength}
          className="w-full rounded-lg border border-felt-700 bg-felt-900 px-3 py-2 text-sm text-bone placeholder:text-bone-dim"
        />
      </div>

      <div>
        <label htmlFor="rt-winner" className="sr-only">
          Winner points
        </label>
        <input
          id="rt-winner"
          type="number"
          inputMode="numeric"
          min={1}
          value={winnerPts}
          onChange={(event) => setWinnerPts(event.target.value)}
          placeholder="Win pts"
          className="numerals w-full rounded-lg border border-felt-700 bg-felt-900 px-3 py-2 text-sm text-bone placeholder:font-sans placeholder:text-bone-dim"
        />
      </div>

      <div>
        <label htmlFor="rt-loser" className="sr-only">
          Fixed loser points, optional
        </label>
        <input
          id="rt-loser"
          type="number"
          inputMode="numeric"
          min={ROUND_TYPE_RULES.minLoserPts}
          value={loserPts}
          onChange={(event) => setLoserPts(event.target.value)}
          placeholder="Lose pts"
          className="numerals w-full rounded-lg border border-felt-700 bg-felt-900 px-3 py-2 text-sm text-bone placeholder:font-sans placeholder:text-bone-dim"
        />
      </div>

      <Button
        variant="primary"
        onClick={handleSubmit}
        className="col-span-2 sm:col-span-1"
      >
        Add type
      </Button>
    </div>
  )
}
