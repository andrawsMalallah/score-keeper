'use client'

import type { ButtonHTMLAttributes } from 'react'
import { vibrate } from '@/lib/haptics'

type Variant = 'primary' | 'secondary' | 'team1' | 'team2' | 'danger' | 'ghost'

/**
 * The accent (teal) is the app's own brand/action colour and doubles as
 * success — it is never a team's identity. team1/team2 are reserved for
 * actions that need to stand apart from a primary button placed right next
 * to them, e.g. "Declare a Winner" (team2) beside "Add round" (primary).
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90 font-semibold',
  secondary: 'bg-muted text-bg hover:opacity-90',
  team1: 'bg-team1 text-on-team1 hover:opacity-90 font-semibold',
  team2: 'bg-team2 text-on-team2 hover:opacity-90 font-semibold',
  danger: 'bg-danger text-on-accent hover:opacity-90',
  ghost: 'text-muted hover:text-fg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({
  variant = 'secondary',
  className = '',
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      // Explicit because a bare <button> inside a form defaults to submit,
      // which has caused accidental submissions in this kind of UI before.
      type="button"
      onClick={(event) => {
        vibrate('selection')
        onClick?.(event)
      }}
      className={`rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
