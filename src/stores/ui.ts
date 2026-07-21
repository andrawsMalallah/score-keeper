import { create } from 'zustand'
import { THEME_STORAGE_KEY } from '@/components/shell/ThemeScript'
import type { GameType } from '@/lib/supabase/types'

export type Theme = 'light' | 'dark'

/**
 * The one UI store, per REBUILD.md §3.1: state that belongs to the browser
 * session rather than the server. Anything that outlives a reload or needs to
 * sync across devices is server state and belongs in TanStack Query instead.
 */
interface UiState {
  theme: Theme
  /** True until the user picks a theme, so we keep following the OS setting. */
  followsSystem: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  /** Applies an OS theme change; ignored once the user has chosen explicitly. */
  syncSystemTheme: (theme: Theme) => void

  /** Round currently open for inline editing on the score strip, if any. */
  editingRoundId: string | null
  setEditingRoundId: (id: string | null) => void

  /**
   * Team ids staged into the two slots before a match starts, kept per game so
   * switching tabs does not disturb the other game's setup.
   *
   * Deliberately not persisted: these are a staging choice that becomes real
   * only when "Start game" writes the match row, which is the point at which
   * the selection stops being disposable.
   */
  slots: Record<GameType, [string | null, string | null]>
  /** Assigns to the first empty slot; returns what the caller should report. */
  assignToSlot: (game: GameType, teamId: string) => SlotAssignment
  clearSlot: (game: GameType, index: 0 | 1) => void
  /** Drops a team from any slot it holds — used after a delete. */
  removeTeamFromSlots: (teamId: string) => void
}

/**
 * What an assignment attempt did, so the component can raise the right toast
 * without re-deriving the rules.
 */
export type SlotAssignment = 'assigned' | 'unassigned' | 'full'

/**
 * Reads the theme the blocking script already resolved, so the store starts in
 * agreement with the DOM instead of causing a hydration mismatch.
 */
function initialTheme(): { theme: Theme; followsSystem: boolean } {
  if (typeof document === 'undefined') {
    // Server render: the script has not run yet. Dark is the design's primary
    // theme, and the attribute is corrected before paint on the client.
    return { theme: 'dark', followsSystem: true }
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  const attribute = document.documentElement.getAttribute('data-theme')
  return {
    theme: attribute === 'light' ? 'light' : 'dark',
    followsSystem: stored !== 'light' && stored !== 'dark',
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export const useUiStore = create<UiState>((set, get) => ({
  ...initialTheme(),

  setTheme: (theme) => {
    applyTheme(theme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    set({ theme, followsSystem: false })
  },

  toggleTheme: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
  },

  syncSystemTheme: (theme) => {
    if (!get().followsSystem) return
    applyTheme(theme)
    set({ theme })
  },

  editingRoundId: null,
  setEditingRoundId: (editingRoundId) => set({ editingRoundId }),

  slots: { cards: [null, null], domino: [null, null] },

  assignToSlot: (game, teamId) => {
    const [first, second] = get().slots[game]

    // Tapping a team that already holds a slot takes it back out (§2.2).
    if (first === teamId) {
      set((state) => ({
        slots: { ...state.slots, [game]: [null, second] },
      }))
      return 'unassigned'
    }
    if (second === teamId) {
      set((state) => ({
        slots: { ...state.slots, [game]: [first, null] },
      }))
      return 'unassigned'
    }

    if (first === null) {
      set((state) => ({
        slots: { ...state.slots, [game]: [teamId, second] },
      }))
      return 'assigned'
    }
    if (second === null) {
      set((state) => ({
        slots: { ...state.slots, [game]: [first, teamId] },
      }))
      return 'assigned'
    }

    return 'full'
  },

  clearSlot: (game, index) => {
    set((state) => {
      const next: [string | null, string | null] = [...state.slots[game]]
      next[index] = null
      return { slots: { ...state.slots, [game]: next } }
    })
  },

  removeTeamFromSlots: (teamId) => {
    set((state) => {
      const slots = { ...state.slots }
      for (const game of Object.keys(slots) as GameType[]) {
        slots[game] = slots[game].map((id) =>
          id === teamId ? null : id,
        ) as [string | null, string | null]
      }
      return { slots }
    })
  },
}))
