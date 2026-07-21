import type { GameType } from '@/lib/supabase/types'

/**
 * The single source of divergence between Cards and Domino.
 *
 * The original app.js duplicated every function across the two games
 * (addRound/addDominoRound, two sidebars, two leaderboards) over ~2,000 lines.
 * Everything that differs between the games belongs in this object so that the
 * route tree and component set stay shared. Adding a third game should mean
 * adding a config entry, not forking a component.
 */
export interface GameConfig {
  /** Which total wins: cards is a golf-style low score, domino is a race up. */
  winnerIs: 'lower' | 'higher'
  /** Floor for the loser's hand points. Cards requires at least 2; domino allows 0. */
  minLoserPoints: number
  /** Cards scores rounds from named presets; domino has none. */
  usesRoundTypes: boolean
  /** Domino blocks declaring a winner until a team reaches the target. */
  usesTarget: boolean
  /** Human label for the game, used in tabs and the title badge. */
  label: string
}

export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  cards: {
    winnerIs: 'lower',
    minLoserPoints: 2,
    usesRoundTypes: true,
    usesTarget: false,
    label: 'Cards',
  },
  domino: {
    winnerIs: 'higher',
    minLoserPoints: 0,
    usesRoundTypes: false,
    usesTarget: true,
    label: 'Domino',
  },
}

export function getGameConfig(game: GameType): GameConfig {
  return GAME_CONFIGS[game]
}

/** Narrowing helper for route params, which arrive as untrusted strings. */
export function isGameType(value: string): value is GameType {
  return value === 'cards' || value === 'domino'
}
