'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { GameType } from '@/lib/supabase/types'
import type { Match } from '@/hooks/useMatch'
import type { ScorableRound } from '@/lib/game/scoring'
import { toast } from '@/stores/toasts'

export const matchHistoryKey = (game: GameType) => ['history', game] as const

/** Cap mirrors §2.8: newest first, capped at 50. */
const HISTORY_LIMIT = 50

/**
 * A history entry needs its rounds to derive totals, margin and round count
 * (§2.8) — the match row alone only carries the winner id.
 */
export interface MatchHistoryEntry extends Match {
  rounds: ScorableRound[]
}

/** Archived matches for a game (§2.8), newest first, with their rounds embedded. */
export function useMatchHistory(game: GameType) {
  return useQuery({
    queryKey: matchHistoryKey(game),
    queryFn: async (): Promise<MatchHistoryEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('matches')
        .select('*, rounds(t1_points, t2_points)')
        .eq('game', game)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false })
        .limit(HISTORY_LIMIT)

      if (error) throw error
      return data as MatchHistoryEntry[]
    },
  })
}

/** Clears all finished matches for a game (§2.8 "Clear", with confirm). */
export function useClearMatchHistory(game: GameType) {
  const queryClient = useQueryClient()
  const key = matchHistoryKey(game)

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('game', game)
        .eq('status', 'finished')

      if (error) throw error
    },

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Match[]>(key)
      queryClient.setQueryData<Match[]>(key, [])
      return { previous }
    },

    onError: (error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error(`Could not clear history. ${error.message}`)
    },
  })
}
