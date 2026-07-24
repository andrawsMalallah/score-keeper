'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  codeToEmail,
  forgetRememberedCode,
  generateCode,
  getRememberedCode,
  isValidCodeFormat,
  normalizeCode,
  rememberCode,
} from '@/lib/auth/code'
import { toast } from '@/stores/toasts'

export const authUserKey = ['auth', 'user'] as const

const MAX_GENERATE_ATTEMPTS = 5

/**
 * Supabase's own rate-limit message ("Email rate limit exceeded", "For
 * security purposes, you can only request this after N seconds.") is
 * accurate but easy to misread as the request having failed outright —
 * reworded so it's clear the fix is "wait," not "try something else." Kept
 * even though no email is actually sent (autoconfirm skips the mailer),
 * since the same per-IP limiter still applies to signUp/token endpoints.
 */
function toFriendlyAuthMessage(error: { message: string; status?: number }): string {
  if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) {
    return "You've made too many attempts recently. Wait a minute or two, then try again."
  }
  return error.message
}

function isDuplicateEmailError(error: { message: string }): boolean {
  return /already registered|already exists/i.test(error.message)
}

/** Whether a session exists at all — every session is now a deliberately
 *  created code account, so this simply gates the app shell vs. the entry
 *  screen (there is no more anonymous-vs-permanent distinction to track). */
export function useHasSession() {
  return useQuery({
    queryKey: authUserKey,
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user !== null
    },
  })
}

/**
 * Creates a brand-new code account: generate a random code, create a hidden
 * password-auth user keyed to a synthetic email derived from it, retrying
 * with a fresh code on the astronomically unlikely event of a collision.
 * Requires "Confirm email" to be disabled in the Supabase dashboard — with it
 * on, signUp would leave the account permanently unconfirmed, since the
 * synthetic address can never receive a real confirmation link.
 *
 * Deliberately does NOT invalidate authUserKey here, even though signUp
 * already leaves the browser holding a valid session — doing so would flip
 * AuthGate into the app immediately and unmount CodeAuthScreen before the
 * generated code ever has a chance to be shown. CodeAuthScreen invalidates it
 * itself once the user taps "Sign in" on the generated-code screen, which is
 * the point the app is meant to actually become visible.
 */
export function useGenerateCode() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const supabase = createClient()

      for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
        const code = generateCode()
        const { data, error } = await supabase.auth.signUp({
          email: codeToEmail(code),
          password: normalizeCode(code),
        })

        if (!error) {
          // Remembered locally so "View code" can show it again later on
          // this same device — Supabase itself never stores it retrievably.
          if (data.user) rememberCode(data.user.id, code)
          return code
        }
        if (!isDuplicateEmailError(error)) throw error
        // Duplicate: loop again with a freshly generated code.
      }

      throw new Error('Could not generate a unique code. Please try again.')
    },

    onError: (error) => {
      toast.error(`Could not generate a code. ${toFriendlyAuthMessage(error)}`)
    },
  })
}

/**
 * The current account's code, if this is the device it was generated on —
 * null both while loading and when this device never generated it (e.g. it
 * joined via "Enter your code" instead, or a different device generated it).
 * There is no server-side way to distinguish those two null cases, since
 * Supabase never stores the plaintext code anywhere retrievable.
 */
export function useRememberedCode() {
  return useQuery({
    queryKey: [...authUserKey, 'remembered-code'],
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null
      return getRememberedCode(user.id)
    },
  })
}

/**
 * Reveals the app after a freshly generated code's "Sign in" button is
 * tapped (see useGenerateCode's note on why that invalidation is deferred to
 * here rather than firing immediately on signUp).
 */
export function useConfirmSessionSaved() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: authUserKey })
}

/**
 * Signs into an existing code account from any device. Deliberately does not
 * distinguish "wrong code" from "no such code" in the error message, the same
 * account-enumeration-avoidance reasoning Supabase's own auth errors use.
 */
export function useSignInWithCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (code: string) => {
      if (!isValidCodeFormat(code)) {
        throw new Error('Enter the 6-character code exactly as it was given to you.')
      }

      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: codeToEmail(code),
        password: normalizeCode(code),
      })

      if (error) throw new Error('Code not found or incorrect.')
      // Remembered locally too, not just on generate, so "View code" works
      // from any device that has ever signed in — not only the one that
      // originally generated it.
      if (data.user) rememberCode(data.user.id, code)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authUserKey })
    },

    onError: (error) => {
      toast.error(toFriendlyAuthMessage(error))
    },
  })
}

/** Signs out of the current code account, returning to the entry screen. */
export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      // So a different group signing into this device afterward never sees
      // the previous group's remembered code.
      forgetRememberedCode()
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authUserKey })
    },

    onError: (error) => {
      toast.error(`Could not sign out. ${error.message}`)
    },
  })
}
