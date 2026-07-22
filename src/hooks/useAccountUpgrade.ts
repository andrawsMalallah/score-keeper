'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/stores/toasts'

export const authUserKey = ['auth', 'user'] as const

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
      toast.error(`Could not save your data. ${error.message}`)
    },
  })
}
