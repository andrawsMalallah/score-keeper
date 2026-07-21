'use client'

import { useState } from 'react'
import type { GameConfig } from '@/lib/game/config'
import type { Round } from '@/hooks/useRounds'

/** Suit glyphs cycle by round number as a small cards garnish (§6.3). */
const SUIT_GLYPHS = ['♠', '♥', '♦', '♣']

interface RoundRowProps {
  round: Round
  index: number
  config: GameConfig
  /** Returns false when the edit was rejected, so the row stays open. */
  onEdit: (t1Points: number, t2Points: number) => boolean
  onDelete: () => void
}

export function RoundRow({
  round,
  index,
  config,
  onEdit,
  onDelete,
}: RoundRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showNote, setShowNote] = useState(false)

  const badge = config.usesRoundTypes
    ? SUIT_GLYPHS[index % SUIT_GLYPHS.length]
    : '🁣'

  if (isEditing) {
    return (
      <EditRow
        round={round}
        index={index}
        onCancel={() => setIsEditing(false)}
        onSave={(t1, t2) => {
          if (onEdit(t1, t2)) setIsEditing(false)
        }}
      />
    )
  }

  return (
    <>
      <tr className="border-b border-fg/10">
        <td className="py-1.5">
          <span className="numerals text-xs opacity-50" aria-hidden="true">
            {badge}
          </span>
          <span className="sr-only">Round {index + 1}</span>
        </td>

        <td className="numerals py-1.5 text-right text-[15px]">
          {round.t1_points}
        </td>
        {/* The hand-ruled centre divider between the two team columns. */}
        <td aria-hidden="true" className="border-l border-fg/20" />
        <td className="numerals py-1.5 text-left text-[15px]">
          {round.t2_points}
        </td>

        <td className="py-1.5 text-right">
          {round.note && (
            <button
              type="button"
              onClick={() => setShowNote((shown) => !shown)}
              aria-expanded={showNote}
              aria-label={showNote ? 'Hide note' : 'Show note'}
              className="px-1 text-xs opacity-60 hover:opacity-100"
            >
              💬
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label={`Edit round ${index + 1}`}
            className="px-1 text-xs opacity-60 hover:opacity-100"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete round ${index + 1}`}
            className="px-1 text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </td>
      </tr>

      {round.note && showNote && (
        <tr>
          <td colSpan={5} className="pb-2 text-xs italic opacity-70">
            {round.note}
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * Split out so the drafts initialise from props on mount rather than being
 * reset by an effect when the row enters edit mode.
 */
function EditRow({
  round,
  index,
  onCancel,
  onSave,
}: {
  round: Round
  index: number
  onCancel: () => void
  onSave: (t1Points: number, t2Points: number) => void
}) {
  const [t1, setT1] = useState(String(round.t1_points))
  const [t2, setT2] = useState(String(round.t2_points))

  function save() {
    const first = Number(t1)
    const second = Number(t2)
    if (!Number.isInteger(first) || !Number.isInteger(second)) return
    onSave(first, second)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') save()
    if (event.key === 'Escape') onCancel()
  }

  return (
    <tr className="border-b border-fg/10 bg-fg/5">
      <td className="py-1.5 text-xs opacity-50">{index + 1}</td>

      <td className="py-1.5 pr-1">
        <label className="sr-only" htmlFor={`edit-t1-${round.id}`}>
          Team 1 points for round {index + 1}
        </label>
        <input
          id={`edit-t1-${round.id}`}
          autoFocus
          onFocus={(event) => event.target.select()}
          type="number"
          value={t1}
          onChange={(event) => setT1(event.target.value)}
          onKeyDown={onKeyDown}
          className="numerals w-full rounded border border-fg/30 bg-bg px-1 py-0.5 text-right text-[15px]"
        />
      </td>
      <td aria-hidden="true" className="border-l border-fg/20" />
      <td className="py-1.5 pl-1">
        <label className="sr-only" htmlFor={`edit-t2-${round.id}`}>
          Team 2 points for round {index + 1}
        </label>
        <input
          id={`edit-t2-${round.id}`}
          type="number"
          value={t2}
          onChange={(event) => setT2(event.target.value)}
          onKeyDown={onKeyDown}
          className="numerals w-full rounded border border-fg/30 bg-bg px-1 py-0.5 text-[15px]"
        />
      </td>

      <td className="py-1.5 text-right">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel edit"
          className="px-1 text-xs opacity-60 hover:opacity-100"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={save}
          aria-label="Save round"
          className="px-1 text-xs font-bold"
        >
          ✓
        </button>
      </td>
    </tr>
  )
}
