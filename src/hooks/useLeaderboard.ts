'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { GameType, LeaderboardRow } from '@/lib/supabase/types'
import { sortLeaderboard } from '@/lib/game/tallies'

export const leaderboardKey = (game: GameType) => ['leaderboard', game] as const

/** Per-team Main/Sub/Rounds totals for a game, sorted per §2.7. */
export function useLeaderboard(game: GameType) {
  return useQuery({
    queryKey: leaderboardKey(game),
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('game', game)

      if (error) throw error
      return sortLeaderboard(data)
    },
  })
}
