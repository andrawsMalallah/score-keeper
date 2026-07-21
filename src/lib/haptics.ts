/**
 * Haptic feedback patterns from REBUILD.md §2.1.
 *
 * Centralised so the whole app buzzes consistently: a selection should feel the
 * same everywhere it happens. navigator.vibrate is unsupported on desktop and
 * iOS Safari, so every call is a silent no-op there by design.
 */

const PATTERNS = {
  /** Picking a winner, tapping a team card — barely perceptible. */
  selection: 12,
  /** A round landed on the strip. */
  roundAdded: 20,
  /** Sub rolled over into a main, or a domino target was reached. */
  milestone: [30, 50, 30],
  /** Match won — the one long celebratory pattern. */
  victory: [100, 50, 100, 50, 200],
} satisfies Record<string, number | number[]>

export type HapticPattern = keyof typeof PATTERNS

export function vibrate(pattern: HapticPattern): void {
  // Respect the same accessibility preference that governs animation: a user
  // who asked for reduced motion did not ask for a buzzing phone either.
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // Copied because navigator.vibrate's signature demands a mutable array.
  const value = PATTERNS[pattern]
  navigator.vibrate(Array.isArray(value) ? [...value] : value)
}
