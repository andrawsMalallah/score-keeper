'use client'

import Link from 'next/link'
import { GAME_CONFIGS } from '@/lib/game/config'
import type { GameType } from '@/lib/supabase/types'
import { vibrate } from '@/lib/haptics'

const GAME_ORDER: GameType[] = ['cards', 'domino']

/**
 * Tabs are links rather than buttons because each game is a real route — this
 * keeps back/forward and deep links working, which a client-side tab state
 * would break.
 */
export function GameTabs({ activeGame }: { activeGame: GameType }) {
  return (
    <nav aria-label="Game" className="flex gap-1">
      {GAME_ORDER.map((game) => {
        const isActive = game === activeGame
        return (
          <Link
            key={game}
            href={`/${game}`}
            onClick={() => vibrate('selection')}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent'
                : 'rounded-full px-4 py-1.5 text-sm text-muted transition-colors hover:text-fg'
            }
          >
            {GAME_CONFIGS[game].label}
          </Link>
        )
      })}
    </nav>
  )
}
