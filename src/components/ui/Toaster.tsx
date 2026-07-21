'use client'

import { useToastStore, type ToastVariant } from '@/stores/toasts'

/**
 * Each variant gets a coloured left edge rather than a filled background, so
 * toasts stay quiet felt objects and the score strip remains the only loud
 * thing on the page. Success reuses brass — per §6.1 there is no separate
 * green, because the whole app is already green.
 */
const VARIANT_EDGE: Record<ToastVariant, string> = {
  info: 'border-l-porcelain',
  success: 'border-l-brass',
  error: 'border-l-clay',
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
          className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-felt-700 border-l-4 bg-felt-800 px-4 py-3 text-sm shadow-lg ${VARIANT_EDGE[toast.variant]}`}
        >
          <p className="flex-1 text-bone">{toast.message}</p>

          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                dismiss(toast.id)
              }}
              className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-brass hover:bg-felt-700"
            >
              {toast.action.label}
            </button>
          )}

          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded px-1 text-bone-dim hover:text-bone"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
