'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database, GameType } from '@/lib/supabase/types'
import { toast } from '@/stores/toasts'

export type Team = Database['public']['Tables']['teams']['Row']

/** Teams are listed per game, so the game is part of the cache key. */
export const teamsKey = (game: GameType) => ['teams', game] as const

export function useTeams(game: GameType) {
  return useQuery({
    queryKey: teamsKey(game),
    queryFn: async (): Promise<Team[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('game', game)
        .order('created_at')

      if (error) throw error
      return data
    },
  })
}

/**
 * Names must be unique case-insensitively within a game (§2.2). Checked here
 * for an instant message; the database constraint remains the real guard
 * against races.
 */
export function isDuplicateName(
  teams: Team[] | undefined,
  name: string,
  ignoreId?: string,
): boolean {
  const candidate = name.trim().toLowerCase()
  return (teams ?? []).some(
    (team) => team.id !== ignoreId && team.name.toLowerCase() === candidate,
  )
}

/**
 * Every mutation below follows the same shape: cancel in-flight refetches,
 * snapshot the cache, apply the change locally so the UI never waits on the
 * network (§3.2), and roll back to the snapshot with an error toast on failure.
 */
export function useAddTeam(game: GameType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string): Promise<Team> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('teams')
        .insert({ game, name: name.trim() })
        .select()
        .single()

      if (error) throw error
      return data
    },

    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: teamsKey(game) })
      const previous = queryClient.getQueryData<Team[]>(teamsKey(game))

      // A placeholder row so the card appears instantly. The id is temporary
      // and gets replaced by the real row when the insert resolves.
      const optimistic: Team = {
        id: `optimistic-${crypto.randomUUID()}`,
        user_id: '',
        game,
        name: name.trim(),
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData<Team[]>(teamsKey(game), (teams) => [
        ...(teams ?? []),
        optimistic,
      ])

      return { previous, optimisticId: optimistic.id }
    },

    onError: (error, _name, context) => {
      queryClient.setQueryData(teamsKey(game), context?.previous)
      toast.error(`Could not add the team. ${error.message}`)
    },

    onSuccess: (team, _name, context) => {
      // Swap the placeholder for the real row rather than refetching, so the
      // card never flickers.
      queryClient.setQueryData<Team[]>(teamsKey(game), (teams) =>
        (teams ?? []).map((existing) =>
          existing.id === context?.optimisticId ? team : existing,
        ),
      )
      // A new team needs a leaderboard row (0 main/sub/rounds) immediately,
      // not just once it has played a match.
      queryClient.invalidateQueries({ queryKey: ['leaderboard', game] })
    },
  })
}

export function useRenameTeam(game: GameType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('teams')
        .update({ name: name.trim() })
        .eq('id', id)

      if (error) throw error
    },

    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: teamsKey(game) })
      const previous = queryClient.getQueryData<Team[]>(teamsKey(game))

      queryClient.setQueryData<Team[]>(teamsKey(game), (teams) =>
        (teams ?? []).map((team) =>
          team.id === id ? { ...team, name: name.trim() } : team,
        ),
      )

      return { previous }
    },

    onError: (error, _variables, context) => {
      queryClient.setQueryData(teamsKey(game), context?.previous)
      toast.error(`Could not rename the team. ${error.message}`)
    },

    // A rename cascades to tallies, history and the leaderboard by id, so those
    // caches are stale even though the teams list is already correct.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard', game] })
      queryClient.invalidateQueries({ queryKey: ['matches', game] })
    },
  })
}

export function useDeleteTeam(game: GameType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      // Rows in pair_tallies, matches and rounds cascade from the foreign keys,
      // so deleting the team is enough to clear its history.
      const { error } = await supabase.from('teams').delete().eq('id', id)
      if (error) throw error
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: teamsKey(game) })
      const previous = queryClient.getQueryData<Team[]>(teamsKey(game))

      queryClient.setQueryData<Team[]>(teamsKey(game), (teams) =>
        (teams ?? []).filter((team) => team.id !== id),
      )

      return { previous }
    },

    onError: (error, _id, context) => {
      queryClient.setQueryData(teamsKey(game), context?.previous)
      toast.error(`Could not delete the team. ${error.message}`)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard', game] })
      queryClient.invalidateQueries({ queryKey: ['matches', game] })
    },
  })
}
