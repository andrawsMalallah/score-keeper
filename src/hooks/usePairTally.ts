'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database, GameType } from '@/lib/supabase/types'
import { normalizePair } from '@/lib/game/tallies'
import { toast } from '@/stores/toasts'

export type PairTally = Database['public']['Tables']['pair_tallies']['Row']

export const pairTallyKey = (
  game: GameType,
  team1Id: string | undefined,
  team2Id: string | undefined,
) => ['pair-tally', game, team1Id, team2Id] as const

/**
 * The Stars/Points tally for the active match's team pair (§2.6). Rows are
 * keyed by low/high team id, so a pair with no wins yet has no row at all —
 * that is a valid, zeroed state, not a loading error.
 */
export function usePairTally(
  game: GameType,
  team1Id: string | undefined,
  team2Id: string | undefined,
) {
  return useQuery({
    queryKey: pairTallyKey(game, team1Id, team2Id),
    enabled: Boolean(team1Id && team2Id),
    queryFn: async (): Promise<PairTally | null> => {
      const { low_team_id, high_team_id } = normalizePair(team1Id!, team2Id!)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pair_tallies')
        .select('*')
        .eq('game', game)
        .eq('low_team_id', low_team_id)
        .eq('high_team_id', high_team_id)
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

/** Zeroes both teams' Stars and Points for the current pair (§2.6 "Reset Counters"). */
export function useResetPairTally(
  game: GameType,
  team1Id: string | undefined,
  team2Id: string | undefined,
) {
  const queryClient = useQueryClient()
  const key = pairTallyKey(game, team1Id, team2Id)

  return useMutation({
    mutationFn: async () => {
      if (!team1Id || !team2Id) return
      const { low_team_id, high_team_id } = normalizePair(team1Id, team2Id)
      const supabase = createClient()
      const { error } = await supabase
        .from('pair_tallies')
        .update({ low_stars: 0, low_points: 0, high_stars: 0, high_points: 0 })
        .eq('game', game)
        .eq('low_team_id', low_team_id)
        .eq('high_team_id', high_team_id)

      if (error) throw error
    },

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PairTally | null>(key)

      queryClient.setQueryData<PairTally | null>(key, (current) =>
        current
          ? { ...current, low_stars: 0, low_points: 0, high_stars: 0, high_points: 0 }
          : current,
      )

      return { previous }
    },

    onError: (error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error(`Could not reset the tally. ${error.message}`)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard', game] })
    },
  })
}
