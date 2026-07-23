'use client'

import { Button } from './Button'

interface StepperProps {
  label: string
  value: number
  min: number
  max?: number
  step?: number
  /** Explains the setting's consequence, e.g. what rollover actually does. */
  hint?: string
  onChange: (value: number) => void
}

/**
 * Number setting with explicit -/+ controls. The controls exist because these
 * are touch targets on a phone at a table; the text input stays editable for
 * anyone who would rather type a big number than tap thirty times.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  onChange,
}: StepperProps) {
  const clamp = (next: number) =>
    Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, next))

  const inputId = `stepper-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={inputId} className="text-sm text-fg">
          {label}
        </label>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="w-10 border border-border bg-surface text-fg hover:border-muted"
        >
          −
        </Button>

        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(event) => {
            const next = Number(event.target.value)
            // Ignore a half-typed or cleared field rather than snapping the
            // value to the minimum while the user is still typing.
            if (!Number.isNaN(next)) onChange(clamp(next))
          }}
          className="numerals w-20 rounded-lg border border-border bg-bg px-3 py-2 text-center text-sm text-fg"
        />

        <Button
          onClick={() => onChange(clamp(value + step))}
          disabled={max !== undefined && value >= max}
          aria-label={`Increase ${label}`}
          className="w-10 border border-border bg-surface text-fg hover:border-muted"
        >
          +
        </Button>
      </div>
    </div>
  )
}
