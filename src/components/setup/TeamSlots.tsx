'use client'

import type { GameType } from '@/lib/supabase/types'
import { useUiStore } from '@/stores/ui'
import { useTeams } from '@/hooks/useTeams'

/**
 * The two staged team positions. The accent marks Team 1 and the secondary
 * accent marks Team 2 everywhere they appear, so a glance at a colour
 * identifies the side without reading the label.
 */
const SLOT_STYLES = [
  { badge: 'Team 1', accent: 'border-accent/50', text: 'text-accent' },
  { badge: 'Team 2', accent: 'border-accent-secondary/50', text: 'text-accent-secondary' },
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
            className={`rounded-xl border bg-bg p-3 ${name ? style.accent : 'border-dashed border-border'}`}
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
                  className="rounded text-muted hover:text-fg"
                >
                  ✕
                </button>
              )}
            </div>

            <p
              className={`mt-1 truncate text-sm ${name ? 'text-fg' : 'text-muted'}`}
            >
              {name ?? 'Tap a team below'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
