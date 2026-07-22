import { GAME_CONFIGS } from '@/lib/game/config'
import type { GameType } from '@/lib/supabase/types'
import { AccountUpgrade } from './AccountUpgrade'
import { GameTabs } from './GameTabs'
import { ImportExport } from './ImportExport'
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
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-extrabold tracking-tight text-fg">
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
          <ImportExport />
          <AccountUpgrade />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
