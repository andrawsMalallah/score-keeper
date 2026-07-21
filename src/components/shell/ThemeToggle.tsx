'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useUiStore } from '@/stores/ui'
import { vibrate } from '@/lib/haptics'

/**
 * Subscribes to the store only after hydration. The server cannot know which
 * theme the blocking script picked, so rendering the real icon during SSR would
 * be a hydration mismatch; this reports false on the server and true after
 * mount, letting us render a stable placeholder first.
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

export function ThemeToggle() {
  const hasMounted = useHasMounted()
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const syncSystemTheme = useUiStore((state) => state.syncSystemTheme)

  // Track the OS setting so the app follows it live, until the user overrides.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) =>
      syncSystemTheme(event.matches ? 'dark' : 'light')

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [syncSystemTheme])

  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button
      type="button"
      onClick={() => {
        vibrate('selection')
        toggleTheme()
      }}
      aria-label={label}
      title={label}
      className="rounded-full border border-felt-700 bg-felt-800 px-3 py-1.5 text-sm text-bone-dim transition-colors hover:text-bone"
    >
      {/* Placeholder keeps the button the same size before hydration. */}
      <span aria-hidden="true">{hasMounted ? (isDark ? '☾' : '☀') : '·'}</span>
    </button>
  )
}
