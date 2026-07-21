'use client'

import type { ButtonHTMLAttributes } from 'react'
import { vibrate } from '@/lib/haptics'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

/**
 * The accent (brick) is the primary action colour and doubles as success —
 * the app has no separate success tone.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90 font-semibold',
  secondary: 'border border-border bg-surface text-fg hover:border-muted',
  danger: 'border border-danger text-danger hover:bg-danger hover:text-on-accent',
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
