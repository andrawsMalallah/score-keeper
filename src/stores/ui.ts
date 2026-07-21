import { create } from 'zustand'
import { THEME_STORAGE_KEY } from '@/components/shell/ThemeScript'

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
}

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
}))
