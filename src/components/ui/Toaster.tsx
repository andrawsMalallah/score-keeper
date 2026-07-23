'use client'

import { useEffect, useRef } from 'react'
import { useToastStore, type ToastVariant } from '@/stores/toasts'

/**
 * Each variant gets a coloured left edge rather than a filled background, so
 * toasts stay quiet objects and the score strip remains the only loud thing
 * on the page. Info and success both reuse the app's own accent (not either
 * team's colour) — there is no separate success tone.
 */
const VARIANT_EDGE: Record<ToastVariant, string> = {
  info: 'border-l-accent',
  success: 'border-l-accent',
  error: 'border-l-danger',
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)
  const containerRef = useRef<HTMLDivElement>(null)

  // Native <dialog showModal()> (ConfirmDialog, VictoryModal, AccountUpgrade)
  // renders in the browser's top layer, which sits above any z-index however
  // high — the popover API puts this container in that same top layer so a
  // toast can render above an open dialog instead of behind its backdrop.
  // But top-layer stacking is insertion order: whichever entered most
  // recently paints highest. A toast fired before a dialog opens (the common
  // case — the popover only opens on the *first* toast of a page load) stays
  // stuck under every dialog opened after it, since nothing ever re-inserts
  // it. Unconditionally hiding + re-showing on every change to `toasts` (not
  // just when it was already open) re-inserts it at the top of the top-layer
  // stack each time, so it always outranks whatever dialog is currently open.
  useEffect(() => {
    const el = containerRef.current
    if (!el || toasts.length === 0) return
    if (el.matches(':popover-open')) el.hidePopover()
    el.showPopover()
  }, [toasts])

  // A dialog opened *after* the popover was last shown still stacks above it
  // (same insertion-order rule) — ConfirmDialog/VictoryModal/AccountUpgrade
  // all call showModal() from their own effects with no shared call site to
  // hook, so watch for the DOM's `open` attribute instead of threading a
  // callback through every dialog. Attribute mutation fires synchronously
  // with showModal(), so this re-promotes before the next paint.
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      const el = containerRef.current
      if (!el || el.children.length === 0) return
      const dialogOpened = mutations.some(
        (mutation) =>
          mutation.target instanceof HTMLDialogElement && mutation.target.open,
      )
      if (!dialogOpened) return
      if (el.matches(':popover-open')) el.hidePopover()
      el.showPopover()
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['open'],
      subtree: true,
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      popover="manual"
      // Polite rather than assertive: score updates should be announced without
      // interrupting whatever the screen reader is currently saying.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-0 m-0 flex h-dvh max-h-none w-screen flex-col items-end justify-end gap-2 border-0 bg-transparent p-4"
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
