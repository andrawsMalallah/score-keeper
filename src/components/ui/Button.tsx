'use client'

import type { ButtonHTMLAttributes } from 'react'
import { vibrate } from '@/lib/haptics'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

/**
 * Brass is the primary action colour (§6.1) and doubles as success — the app is
 * already green, so there is no separate success tone.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brass text-ink hover:opacity-90 font-semibold',
  secondary: 'border border-felt-700 bg-felt-800 text-bone hover:border-bone-dim',
  danger: 'border border-clay text-clay hover:bg-clay hover:text-bone',
  ghost: 'text-bone-dim hover:text-bone',
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
