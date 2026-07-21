'use client'

import { useToastStore, type ToastVariant } from '@/stores/toasts'

/**
 * Each variant gets a coloured left edge rather than a filled background, so
 * toasts stay quiet objects and the score strip remains the only loud thing
 * on the page. Success reuses the accent — there is no separate success tone.
 */
const VARIANT_EDGE: Record<ToastVariant, string> = {
  info: 'border-l-accent-secondary',
  success: 'border-l-accent',
  error: 'border-l-danger',
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <div
      // Polite rather than assertive: score updates should be announced without
      // interrupting whatever the screen reader is currently saying.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-border border-l-4 bg-surface px-4 py-3 text-sm shadow-lg ${VARIANT_EDGE[toast.variant]}`}
        >
          <p className="flex-1 text-fg">{toast.message}</p>

          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                dismiss(toast.id)
              }}
              className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-accent hover:bg-border"
            >
              {toast.action.label}
            </button>
          )}

          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded px-1 text-muted hover:text-fg"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
