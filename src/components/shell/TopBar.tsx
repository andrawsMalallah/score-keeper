import { GAME_CONFIGS } from '@/lib/game/config'
import type { GameType } from '@/lib/supabase/types'
import { GameTabs } from './GameTabs'
import { MoreMenu } from './MoreMenu'
import { ThemeToggle } from './ThemeToggle'

interface TopBarProps {
  activeGame: GameType
  /**
   * Tabs hide and the title badge appears while a match is running (§2.1), so
   * the shell stops offering a game switch mid-score.
   */
  matchInProgress?: boolean
}

export function TopBar({ activeGame, matchInProgress = false }: TopBarProps) {
  const config = GAME_CONFIGS[activeGame]

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-extrabold tracking-tight text-fg sm:text-lg">
            Score Keeper
          </span>

          {matchInProgress && (
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted">
              <span aria-hidden="true">{config.badgeGlyph}</span>{' '}
              {config.label}
            </span>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!matchInProgress && <GameTabs activeGame={activeGame} />}
          <ThemeToggle />
          <MoreMenu />
        </div>
      </div>
    </header>
  )
}
