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

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
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

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      className="max-w-sm rounded-xl border border-felt-700 bg-felt-800 p-5 text-bone backdrop:bg-black/60 open:animate-none"
    >
      <h2
        id="confirm-dialog-title"
        className="font-display text-base font-bold text-bone"
      >
        {title}
      </h2>
      <p className="mt-2 text-sm text-bone-dim">{body}</p>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
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
