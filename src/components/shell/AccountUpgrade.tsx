'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  authUserKey,
  useIsAnonymous,
  useSignIn,
  useUpgradeAccount,
} from '@/hooks/useAccountUpgrade'
import { useTeams } from '@/hooks/useTeams'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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
    } else if (searchParams.get('signedin')) {
      toast.success("You're signed in — your saved data is loading.")
      // A sign-in swaps to a different user id entirely, so every query keyed
      // on "current user" (teams, matches, tallies, settings...) is stale,
      // not just auth state — a full reload is simplest and matches the
      // reload ImportExport already does after a wholesale data replacement.
      window.location.href = pathname
    } else if (searchParams.get('auth_error')) {
      toast.error('That link is invalid or expired. Try sending a new one.')
      router.replace(pathname)
    }
  }, [searchParams, queryClient, router, pathname])

  return null
}

/**
 * Menu item that opens the account-upgrade dialog. Split from the dialog
 * itself (AccountUpgradeDialog) because the dialog must stay mounted at a
 * fixed position independent of MoreMenu's open state — see the comment in
 * MoreMenu.tsx for why. Hidden once the session is already permanent.
 */
export function AccountUpgradeTrigger({
  onOpen,
  onAction,
}: {
  onOpen: () => void
  onAction?: () => void
}) {
  const { data: isAnonymous } = useIsAnonymous()

  if (!isAnonymous) return null

  return (
    <Button
      variant="ghost"
      className="w-full text-left"
      role="menuitem"
      onClick={() => {
        onOpen()
        onAction?.()
      }}
    >
      Save your data
    </Button>
  )
}

const COPY = {
  save: {
    title: 'Save your data',
    body: "Add an email to keep your teams, matches and tallies if you sign out or switch devices. We'll send a confirmation link.",
    submitLabel: 'Send link',
    toggleLabel: 'Already saved on another device? Sign in instead',
  },
  signin: {
    title: 'Sign in',
    body: "Enter the email you already saved your data with. We'll send a sign-in link — this replaces whatever is on this device with that account's data.",
    submitLabel: 'Send link',
    toggleLabel: 'New here? Save your data instead',
  },
} as const

/**
 * "Save your data" / "Sign in" dialog (Phase 8 — REBUILD.md §3.2, extended
 * for multi-device access): one dialog, two modes toggled in place rather
 * than two separate dialogs, since they share the same email-input shape and
 * only differ in which mutation runs and what the copy says. Rendered from a
 * single fixed JSX position in MoreMenu regardless of the menu's own open
 * state — see the comment there. `open`/`onClose` are lifted to the caller
 * for the same reason VictoryModal's are lifted to PlayScreen: unmounting
 * this component in the same commit that toggles its dialog open would
 * close it before showModal() ever runs.
 */
export function AccountUpgrade({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const upgrade = useUpgradeAccount()
  const signIn = useSignIn()
  const { data: cardsTeams } = useTeams('cards')
  const { data: dominoTeams } = useTeams('domino')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<'save' | 'signin'>('save')
  const [email, setEmail] = useState('')
  const [confirmSignIn, setConfirmSignIn] = useState(false)

  const copy = COPY[mode]
  const pending = mode === 'save' ? upgrade.isPending : signIn.isPending
  // Signing in swaps to a different account entirely; anything under the
  // current session that was never saved becomes unreachable through this
  // browser afterward, so the switch is worth confirming first.
  const hasLocalData = (cardsTeams?.length ?? 0) > 0 || (dominoTeams?.length ?? 0) > 0

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

  function resetAndClose() {
    onClose()
    setEmail('')
    setMode('save')
  }

  function doSignIn() {
    signIn.mutate(email, { onSuccess: resetAndClose })
  }

  function handleSubmit() {
    if (mode === 'save') {
      upgrade.mutate(email, { onSuccess: resetAndClose })
      return
    }
    if (hasLocalData) {
      setConfirmSignIn(true)
      return
    }
    doSignIn()
  }

  return (
    <>
      <Suspense fallback={null}>
        <UpgradeRedirectResult />
      </Suspense>

      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby="account-upgrade-title"
          className="w-full max-w-xl rounded-xl border border-border bg-surface p-5 text-fg backdrop:bg-black/75 open:animate-none"
        >
          <h2
            id="account-upgrade-title"
            className="font-display text-base font-bold text-fg"
          >
            {copy.title}
          </h2>
          <p className="mt-2 text-sm text-muted">{copy.body}</p>

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              handleSubmit()
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

            <button
              type="button"
              onClick={() => setMode((m) => (m === 'save' ? 'signin' : 'save'))}
              className="text-xs text-accent hover:underline"
            >
              {copy.toggleLabel}
            </button>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={pending}>
                {copy.submitLabel}
              </Button>
            </div>
          </form>
        </dialog>
      )}

      <ConfirmDialog
        open={confirmSignIn}
        title="Sign in on this device?"
        body="This device has teams or matches that were never saved to an account. Signing in switches to the other account's data — what's here now won't be reachable afterward unless you export a backup first."
        confirmLabel="Sign in anyway"
        destructive
        onCancel={() => setConfirmSignIn(false)}
        onConfirm={() => {
          setConfirmSignIn(false)
          doSignIn()
        }}
      />
    </>
  )
}
