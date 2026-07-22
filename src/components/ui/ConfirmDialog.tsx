'use client'

import { useEffect, useRef } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Say what will actually happen, including anything irreversible. */
  body: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Replaces window.confirm(), which the spec bans (§6.6) because it cannot be
 * styled and reads as a browser error.
 *
 * Built on <dialog showModal()> so focus trapping, Escape-to-close, inert
 * background and the top layer all come from the platform rather than from
 * hand-rolled key handling.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  /*
   * Depends on `open`, not just on mount: React keeps the component instance
   * alive across open/closed transitions, so an empty dependency array runs
   * once and leaves later openings as an inert <dialog> that renders nothing.
   * Effects run after the DOM commits, so the ref is set by the time this fires.
   */
  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  // Escape fires the dialog's own cancel event; route it through the same
  // handler as the Cancel button so state stays in step either way.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onDialogCancel = (event: Event) => {
      event.preventDefault()
      onCancel()
    }

    dialog.addEventListener('cancel', onDialogCancel)
    return () => dialog.removeEventListener('cancel', onDialogCancel)
  }, [onCancel])

  // Unmount while closed rather than hiding. Callers derive the title from the
  // item being deleted, which is null when the dialog is shut, so staying
  // mounted put strings like "Delete undefined?" in the accessibility tree.
  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      className="max-w-sm rounded-xl border border-border bg-surface p-5 text-fg backdrop:bg-black/60 open:animate-none"
    >
      <h2
        id="confirm-dialog-title"
        className="font-display text-base font-bold text-fg"
      >
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted">{body}</p>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
