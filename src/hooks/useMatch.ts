'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database, GameType } from '@/lib/supabase/types'
import { toast } from '@/stores/toasts'

export type Match = Database['public']['Tables']['matches']['Row']

export const activeMatchKey = (game: GameType) =>
  ['match', game, 'active'] as const

/**
 * The live match for a game, or null when the user is between matches.
 *
 * `matches_one_active` is a partial unique index, so at most one row can ever
 * satisfy this filter — maybeSingle is exact rather than optimistic.
 */
export function useActiveMatch(game: GameType) {
  return useQuery({
    queryKey: activeMatchKey(game),
    queryFn: async (): Promise<Match | null> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('game', game)
        .eq('status', 'active')
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

export interface StartMatchInput {
  team1Id: string
  team2Id: string
  /** Domino only. The schema rejects a target on cards. */
  targetPoints?: number | null
}

export function useStartMatch(game: GameType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: StartMatchInput): Promise<Match> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('matches')
        .insert({
          game,
          team1_id: input.team1Id,
          team2_id: input.team2Id,
          // The check constraint requires null for cards, so never forward a
          // stale target from the settings row.
          target_points: game === 'domino' ? (input.targetPoints ?? null) : null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    onSuccess: (match) => {
      queryClient.setQueryData(activeMatchKey(game), match)
    },

    onError: (error) => {
      toast.error(`Could not start the match. ${error.message}`)
    },
  })
}

/**
 * Abandons the live match without archiving it (§2.4). Deleting rather than
 * marking it finished is what keeps it out of history: history is this same
 * table filtered to status = 'finished'.
 */
export function useAbandonMatch(game: GameType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (matchId: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('matches').delete().eq('id', matchId)
      if (error) throw error
    },

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: activeMatchKey(game) })
      const previous = queryClient.getQueryData<Match | null>(
        activeMatchKey(game),
      )
      queryClient.setQueryData(activeMatchKey(game), null)
      return { previous }
    },

    onError: (error, _matchId, context) => {
      queryClient.setQueryData(activeMatchKey(game), context?.previous)
      toast.error(`Could not end the match. ${error.message}`)
    },
  })
}
