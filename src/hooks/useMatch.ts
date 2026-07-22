'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database, GameType } from '@/lib/supabase/types'
import { toast } from '@/stores/toasts'
import { roundsKey } from './useRounds'

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

export interface DeclareWinnerInput {
  matchId: string
  winnerTeamId: string
}

/**
 * Archives the match and credits the winner's pair tally via the
 * `declare_winner` RPC (§2.9). Both writes happen in one Postgres function so
 * they cannot partially apply.
 */
export function useDeclareWinner(game: GameType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeclareWinnerInput): Promise<Match> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .rpc('declare_winner', {
          p_match_id: input.matchId,
          p_winner_team_id: input.winnerTeamId,
        })
        .single()

      if (error) throw error
      return data
    },

    onSuccess: () => {
      queryClient.setQueryData(activeMatchKey(game), null)
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['pair-tally'] })
      queryClient.invalidateQueries({ queryKey: ['history', game] })
    },

    onError: (error) => {
      toast.error(`Could not declare a winner. ${error.message}`)
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

/**
 * Keeps a live match in sync across devices (§4.2): subscribes to Postgres
 * changes on this match's row and its rounds, and invalidates the matching
 * query keys so the existing fetchers/optimistic-update logic just re-run.
 * Requires Realtime replication enabled on `rounds`/`matches` — see the
 * `alter publication supabase_realtime` lines in supabase/migrations/0001_init.sql.
 */
export function useRealtimeMatch(game: GameType, matchId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!matchId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `match_id=eq.${matchId}` },
        () => queryClient.invalidateQueries({ queryKey: roundsKey(matchId) }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => queryClient.invalidateQueries({ queryKey: activeMatchKey(game) }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [game, matchId, queryClient])
}
