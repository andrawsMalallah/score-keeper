'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/stores/toasts'

export const authUserKey = ['auth', 'user'] as const

/**
 * Supabase's own rate-limit message ("Email rate limit exceeded", "For
 * security purposes, you can only request this after N seconds.") is
 * accurate but easy to misread as the request having failed outright —
 * reworded so it's clear the fix is "wait," not "try something else."
 */
function toFriendlyAuthMessage(error: { message: string; status?: number }): string {
  if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) {
    return "You've requested too many links recently. Wait a minute or two, then try again."
  }
  return error.message
}

/**
 * Whether the current session belongs to an anonymous user (Supabase's
 * `is_anonymous` flag), so UI can offer "Save your data" only when there is
 * actually something to upgrade.
 */
export function useIsAnonymous() {
  return useQuery({
    queryKey: authUserKey,
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user?.is_anonymous ?? false
    },
  })
}

/**
 * Upgrades an anonymous user to a permanent account via magic link.
 * `updateUser({ email })` (not `linkIdentity`, which is OAuth-only) sends a
 * confirmation link; clicking it completes the upgrade in place through
 * /auth/callback without losing any of the anonymous user's data.
 */
export function useUpgradeAccount() {
  return useMutation({
    mutationFn: async (email: string) => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/auth/callback` },
      )
      if (error) throw error
    },

    onSuccess: () => {
      toast.success('Check your email to confirm and save your data.')
    },

    onError: (error) => {
      toast.error(`Could not save your data. ${toFriendlyAuthMessage(error)}`)
    },
  })
}

/**
 * Signs into an *existing* permanent account from a fresh browser/device —
 * the counterpart to useUpgradeAccount, which only ever links an email to
 * the current anonymous session. `shouldCreateUser: false` is deliberate:
 * without it, signInWithOtp silently creates a brand-new account for an
 * unrecognized email instead of failing, which would let a typo look like a
 * successful sign-in. This replaces the current session (anonymous or not)
 * rather than merging into it — any data under the previous session's user
 * id is not moved, which is why the UI warns before calling this when the
 * current session still has local-only data.
 */
export function useSignIn() {
  return useMutation({
    mutationFn: async (email: string) => {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    },

    onSuccess: () => {
      toast.success('Check your email for a sign-in link.')
    },

    onError: (error) => {
      toast.error(`Could not sign in. ${toFriendlyAuthMessage(error)}`)
    },
  })
}
