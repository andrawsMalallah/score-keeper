'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { authUserKey, useIsAnonymous, useUpgradeAccount } from '@/hooks/useAccountUpgrade'
import { Button } from '@/components/ui/Button'
import { toast } from '@/stores/toasts'

/**
 * /auth/callback redirects here with ?upgraded=1 or ?auth_error=1 — surfaces
 * the result and strips the param so a refresh doesn't re-fire the toast.
 * Split out because useSearchParams() requires a Suspense boundary, and this
 * is the only part of AccountUpgrade that needs it.
 */
function UpgradeRedirectResult() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('upgraded')) {
      toast.success("You're all set — this account is now saved.")
      queryClient.invalidateQueries({ queryKey: authUserKey })
      router.replace(pathname)
    } else if (searchParams.get('auth_error')) {
      toast.error('That link is invalid or expired. Try sending a new one.')
      router.replace(pathname)
    }
  }, [searchParams, queryClient, router, pathname])

  return null
}

/**
 * "Save your data" entry point (Phase 8 — REBUILD.md §3.2): lets an anonymous
 * user link an email via magic link without losing their teams/matches/
 * tallies. Hidden once the session is already permanent. Always visible in
 * TopBar rather than scoped to setup screens like ImportExport, since saving
 * an account isn't game- or screen-specific.
 */
export function AccountUpgrade() {
  const { data: isAnonymous } = useIsAnonymous()
  const upgrade = useUpgradeAccount()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onDialogCancel = (event: Event) => {
      event.preventDefault()
      setOpen(false)
    }

    dialog.addEventListener('cancel', onDialogCancel)
    return () => dialog.removeEventListener('cancel', onDialogCancel)
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <UpgradeRedirectResult />
      </Suspense>

      {isAnonymous && (
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Save your data
        </Button>
      )}

      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby="account-upgrade-title"
          className="max-w-sm rounded-xl border border-border bg-surface p-5 text-fg backdrop:bg-black/60 open:animate-none"
        >
          <h2
            id="account-upgrade-title"
            className="font-display text-base font-bold text-fg"
          >
            Save your data
          </h2>
          <p className="mt-2 text-sm text-muted">
            Add an email to keep your teams, matches and tallies if you sign
            out or switch devices. We&apos;ll send a confirmation link.
          </p>

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              upgrade.mutate(email, {
                onSuccess: () => {
                  setOpen(false)
                  setEmail('')
                },
              })
            }}
          >
            <label className="block">
              <span className="sr-only">Email address</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent"
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={upgrade.isPending}>
                Send link
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </>
  )
}
