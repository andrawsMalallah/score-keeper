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
      <div className="mx-auto flex max-w-3xl items-center gap-x-2 px-2 py-2 sm:flex-wrap sm:gap-x-3 sm:gap-y-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="truncate font-display text-sm font-extrabold tracking-tight text-fg sm:text-base md:text-lg">
            Score Keeper
          </span>

          {matchInProgress && (
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted">
              <span aria-hidden="true">{config.badgeGlyph}</span>{' '}
              {config.label}
            </span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {!matchInProgress && <GameTabs activeGame={activeGame} />}
          <ThemeToggle />
          <MoreMenu />
        </div>
      </div>
    </header>
  )
}
