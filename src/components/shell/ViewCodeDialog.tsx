'use client'

import { useEffect, useRef, useState } from 'react'
import { useRememberedCode } from '@/hooks/useCodeAuth'
import { toast } from '@/stores/toasts'
import { Button } from '@/components/ui/Button'

/**
 * Shows this account's code again, on any device that has generated OR
 * signed into it. Supabase never stores the plaintext code anywhere
 * retrievable after signUp/signInWithPassword — it is only ever used as a
 * password, then hashed — so this can only work by reading back what
 * useGenerateCode/useSignInWithCode each save locally on success (see
 * rememberCode in lib/auth/code.ts). A device that has never done either has
 * nothing to show here yet.
 */
export function ViewCodeDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { data: code, isPending } = useRememberedCode()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onDialogCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', onDialogCancel)
    return () => dialog.removeEventListener('cancel', onDialogCancel)
  }, [onClose])

  async function handleCopy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      toast.error('Could not copy. Select and copy the code manually.')
    }
  }

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="view-code-title"
      className="w-full max-w-xl rounded-xl border border-border bg-surface p-5 text-fg backdrop:bg-black/75 open:animate-none"
    >
      <h2 id="view-code-title" className="font-display text-base font-bold text-fg">
        Your code
      </h2>

      {isPending ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : code ? (
        <>
          <p className="numerals mt-4 text-center text-4xl font-bold tracking-[0.2em] text-fg">
            {code}
          </p>
          <p className="mt-3 text-sm text-muted">
            Share this with anyone who needs to sign in — there is no email
            recovery, so this code is the only way into the account.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          This device doesn&rsquo;t have your code saved — sign in with it
          here once and it&rsquo;ll be remembered for next time, or check a
          device that has signed in before.
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {code && (
          <Button variant="primary" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy code'}
          </Button>
        )}
      </div>
    </dialog>
  )
}
