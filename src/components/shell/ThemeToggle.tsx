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

  /*
   * Every theme-dependent attribute has to wait for the mount check, not just
   * the icon: the server always renders the store's initial 'dark' while the
   * client renders the real theme, so an unguarded label is a hydration
   * mismatch for anyone on the light theme. The generic fallback is accurate in
   * both themes, so assistive tech is never told the wrong thing.
   */
  const label = hasMounted
    ? isDark
      ? 'Switch to light theme'
      : 'Switch to dark theme'
    : 'Switch theme'

  return (
    <button
      type="button"
      onClick={() => {
        vibrate('selection')
        toggleTheme()
      }}
      aria-label={label}
      title={label}
      className="flex size-[30px] items-center justify-center rounded-full border border-border bg-surface text-sm text-muted transition-colors hover:text-fg sm:size-[34px]"
    >
      {/* Placeholder keeps the button the same size before hydration. */}
      <span aria-hidden="true">{hasMounted ? (isDark ? '☾' : '☀') : '·'}</span>
    </button>
  )
}
