'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { toast } from '@/stores/toasts'

export type Settings = Database['public']['Tables']['settings']['Row']
type SettingsUpdate = Database['public']['Tables']['settings']['Update']

export const settingsKey = ['settings'] as const

/**
 * Bounds mirrored from the check constraints in 0001_init.sql. Duplicated here
 * so the stepper cannot offer a value the database will reject; the constraint
 * remains the real guard.
 */
export const SETTINGS_BOUNDS = {
  pointsRollover: { min: 2, max: 99 },
  dominoTarget: { min: 1, max: 9999 },
} as const

export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async (): Promise<Settings | null> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patch: SettingsUpdate) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('No session.')

      // Upsert rather than update: a brand-new anonymous user has no settings
      // row until they change something.
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: user.id, ...patch })

      if (error) throw error
    },

    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKey })
      const previous = queryClient.getQueryData<Settings | null>(settingsKey)

      queryClient.setQueryData<Settings | null>(settingsKey, (current) =>
        current ? { ...current, ...patch } : current,
      )

      return { previous }
    },

    onError: (error, _patch, context) => {
      queryClient.setQueryData(settingsKey, context?.previous)
      toast.error(`Could not save the setting. ${error.message}`)
    },
  })
}
