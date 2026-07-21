'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { toast } from '@/stores/toasts'

export type Round = Database['public']['Tables']['rounds']['Row']

export const roundsKey = (matchId: string) => ['rounds', matchId] as const

export function useRounds(matchId: string | undefined) {
  return useQuery({
    queryKey: roundsKey(matchId ?? 'none'),
    // Nothing to fetch between matches; the play route redirects anyway.
    enabled: Boolean(matchId),
    queryFn: async (): Promise<Round[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('match_id', matchId!)
        .order('position')

      if (error) throw error
      return data
    },
  })
}

export interface AddRoundInput {
  matchId: string
  t1Points: number
  t2Points: number
  winnerTeamId: string
  /** Cards only: the round type's winner value used for this round. */
  winnerPts?: number | null
  note?: string
}

export function useAddRound() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: AddRoundInput): Promise<Round> => {
      const supabase = createClient()

      // Position is derived from what is already stored rather than from the
      // cache, so a stale cache cannot collide with the (match_id, position)
      // unique constraint.
      const { data: last } = await supabase
        .from('rounds')
        .select('position')
        .eq('match_id', input.matchId)
        .order('position', { ascending: false })
        .limit(1)

      const { data, error } = await supabase
        .from('rounds')
        .insert({
          match_id: input.matchId,
          position: (last?.[0]?.position ?? -1) + 1,
          t1_points: input.t1Points,
          t2_points: input.t2Points,
          winner_team_id: input.winnerTeamId,
          winner_pts: input.winnerPts ?? null,
          note: input.note ?? '',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    onMutate: async (input) => {
      const key = roundsKey(input.matchId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Round[]>(key)

      const optimistic: Round = {
        id: `optimistic-${crypto.randomUUID()}`,
        match_id: input.matchId,
        position: previous?.length ?? 0,
        t1_points: input.t1Points,
        t2_points: input.t2Points,
        winner_team_id: input.winnerTeamId,
        winner_pts: input.winnerPts ?? null,
        note: input.note ?? '',
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData<Round[]>(key, (rounds) => [
        ...(rounds ?? []),
        optimistic,
      ])

      return { previous, optimisticId: optimistic.id }
    },

    onError: (error, input, context) => {
      queryClient.setQueryData(roundsKey(input.matchId), context?.previous)
      toast.error(`Could not add the round. ${error.message}`)
    },

    onSuccess: (round, input, context) => {
      queryClient.setQueryData<Round[]>(roundsKey(input.matchId), (rounds) =>
        (rounds ?? []).map((existing) =>
          existing.id === context?.optimisticId ? round : existing,
        ),
      )
      // Rounds won is derived from the rounds table by the leaderboard view,
      // so the view is stale but nothing needs incrementing by hand.
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

export interface EditRoundInput {
  matchId: string
  roundId: string
  t1Points: number
  t2Points: number
  /** Recomputed by the caller from the game's comparison direction. */
  winnerTeamId: string
  note?: string
}

export function useEditRound() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: EditRoundInput) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('rounds')
        .update({
          t1_points: input.t1Points,
          t2_points: input.t2Points,
          winner_team_id: input.winnerTeamId,
          ...(input.note !== undefined ? { note: input.note } : {}),
        })
        .eq('id', input.roundId)

      if (error) throw error
    },

    onMutate: async (input) => {
      const key = roundsKey(input.matchId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Round[]>(key)

      queryClient.setQueryData<Round[]>(key, (rounds) =>
        (rounds ?? []).map((round) =>
          round.id === input.roundId
            ? {
                ...round,
                t1_points: input.t1Points,
                t2_points: input.t2Points,
                winner_team_id: input.winnerTeamId,
                note: input.note ?? round.note,
              }
            : round,
        ),
      )

      return { previous }
    },

    onError: (error, input, context) => {
      queryClient.setQueryData(roundsKey(input.matchId), context?.previous)
      toast.error(`Could not save the round. ${error.message}`)
    },

    // An edit can flip which team won the round, which changes the derived
    // rounds-won count.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

export function useDeleteRound() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ roundId }: { matchId: string; roundId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from('rounds').delete().eq('id', roundId)
      if (error) throw error
    },

    onMutate: async (input) => {
      const key = roundsKey(input.matchId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Round[]>(key)

      queryClient.setQueryData<Round[]>(key, (rounds) =>
        (rounds ?? []).filter((round) => round.id !== input.roundId),
      )

      return { previous }
    },

    onError: (error, input, context) => {
      queryClient.setQueryData(roundsKey(input.matchId), context?.previous)
      toast.error(`Could not delete the round. ${error.message}`)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}
