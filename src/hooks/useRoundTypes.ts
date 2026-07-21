'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { toast } from '@/stores/toasts'

export type RoundType = Database['public']['Tables']['round_types']['Row']

/** Round types are cards-only, so the key needs no game segment. */
export const roundTypesKey = ['round_types'] as const

export function useRoundTypes() {
  return useQuery({
    queryKey: roundTypesKey,
    queryFn: async (): Promise<RoundType[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('round_types')
        .select('*')
        .order('position')

      if (error) throw error
      return data
    },
  })
}

/**
 * Bounds mirrored from the check constraints in 0001_init.sql. The winner's
 * points are always negative — a cards round type takes points off the winner's
 * total — and a fixed loser value must be at least 2.
 */
export const ROUND_TYPE_RULES = {
  nameMaxLength: 30,
  minLoserPts: 2,
} as const

export function isDuplicateRoundTypeName(
  roundTypes: RoundType[] | undefined,
  name: string,
  ignoreId?: string,
): boolean {
  const candidate = name.trim().toLowerCase()
  return (roundTypes ?? []).some(
    (type) => type.id !== ignoreId && type.name.toLowerCase() === candidate,
  )
}

export interface NewRoundType {
  name: string
  /** Stored negative; the form collects a positive number and negates it. */
  winnerPts: number
  loserPts: number | null
}

export function useAddRoundType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewRoundType): Promise<RoundType> => {
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('round_types')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)

      const { data, error } = await supabase
        .from('round_types')
        .insert({
          name: input.name.trim(),
          winner_pts: input.winnerPts,
          loser_pts: input.loserPts,
          position: (existing?.[0]?.position ?? -1) + 1,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: roundTypesKey })
      const previous = queryClient.getQueryData<RoundType[]>(roundTypesKey)

      const optimistic: RoundType = {
        id: `optimistic-${crypto.randomUUID()}`,
        user_id: '',
        name: input.name.trim(),
        winner_pts: input.winnerPts,
        loser_pts: input.loserPts,
        is_default: false,
        position: (previous?.length ?? 0),
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData<RoundType[]>(roundTypesKey, (types) => [
        ...(types ?? []),
        optimistic,
      ])

      return { previous, optimisticId: optimistic.id }
    },

    onError: (error, _input, context) => {
      queryClient.setQueryData(roundTypesKey, context?.previous)
      toast.error(`Could not add the round type. ${error.message}`)
    },

    onSuccess: (created, _input, context) => {
      queryClient.setQueryData<RoundType[]>(roundTypesKey, (types) =>
        (types ?? []).map((type) =>
          type.id === context?.optimisticId ? created : type,
        ),
      )
    },
  })
}

/**
 * Moves the default flag to another round type.
 *
 * The writes are ordered deliberately: `round_types_one_default` is a partial
 * unique index, so setting the new default while the old one still holds the
 * flag violates it. Clear first, then set.
 */
export function useSetDefaultRoundType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()

      const { error: clearError } = await supabase
        .from('round_types')
        .update({ is_default: false })
        .eq('is_default', true)
      if (clearError) throw clearError

      const { error } = await supabase
        .from('round_types')
        .update({ is_default: true })
        .eq('id', id)
      if (error) throw error
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: roundTypesKey })
      const previous = queryClient.getQueryData<RoundType[]>(roundTypesKey)

      queryClient.setQueryData<RoundType[]>(roundTypesKey, (types) =>
        (types ?? []).map((type) => ({ ...type, is_default: type.id === id })),
      )

      return { previous }
    },

    onError: (error, _id, context) => {
      queryClient.setQueryData(roundTypesKey, context?.previous)
      toast.error(`Could not change the default. ${error.message}`)
    },
  })
}

export function useDeleteRoundType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('round_types').delete().eq('id', id)
      if (error) throw error
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: roundTypesKey })
      const previous = queryClient.getQueryData<RoundType[]>(roundTypesKey)

      queryClient.setQueryData<RoundType[]>(roundTypesKey, (types) =>
        (types ?? []).filter((type) => type.id !== id),
      )

      return { previous }
    },

    onError: (error, _id, context) => {
      queryClient.setQueryData(roundTypesKey, context?.previous)
      toast.error(`Could not delete the round type. ${error.message}`)
    },
  })
}
