'use client'

import type { GameType } from '@/lib/supabase/types'
import { useUiStore } from '@/stores/ui'
import { useTeams } from '@/hooks/useTeams'

/**
 * The two staged team positions. Brass marks Team 1 and porcelain Team 2
 * everywhere they appear (§6.1), so a glance at a colour identifies the side
 * without reading the label.
 */
const SLOT_STYLES = [
  { badge: 'Team 1', accent: 'border-brass/50', text: 'text-brass' },
  { badge: 'Team 2', accent: 'border-porcelain/50', text: 'text-porcelain' },
] as const

export function TeamSlots({ game }: { game: GameType }) {
  const { data: teams } = useTeams(game)
  const slots = useUiStore((state) => state.slots[game])
  const clearSlot = useUiStore((state) => state.clearSlot)

  const teamName = (id: string | null) =>
    id === null ? null : (teams?.find((team) => team.id === id)?.name ?? null)

  return (
    <div className="grid grid-cols-2 gap-3">
      {slots.map((teamId, index) => {
        const style = SLOT_STYLES[index]
        const name = teamName(teamId)

        return (
          <div
            key={style.badge}
            className={`rounded-xl border bg-felt-900 p-3 ${name ? style.accent : 'border-dashed border-felt-700'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={`text-xs font-semibold tracking-wide uppercase ${style.text}`}
              >
                {style.badge}
              </span>

              {name && (
                <button
                  type="button"
                  onClick={() => clearSlot(game, index as 0 | 1)}
                  aria-label={`Clear ${style.badge}`}
                  className="rounded text-bone-dim hover:text-bone"
                >
                  ✕
                </button>
              )}
            </div>

            <p
              className={`mt-1 truncate text-sm ${name ? 'text-bone' : 'text-bone-dim'}`}
            >
              {name ?? 'Tap a team below'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
