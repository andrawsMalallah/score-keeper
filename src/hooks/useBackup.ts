'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database, GameType, Round } from '@/lib/supabase/types'
import type { ImportMatch, ImportPayload, ImportTeam, ParseResult } from '@/lib/migrate'
import { parseBackupFile } from '@/lib/migrate'
import { toast } from '@/stores/toasts'

type MatchWithRounds = Database['public']['Tables']['matches']['Row'] & {
  rounds: Round[]
}

/**
 * Builds an ImportPayload from this account's current data, so export and
 * import share one shape (parseBackupFile's "current" branch is this
 * function's output, byte for byte). Teams are addressed by id here, which
 * is fine on export because import_backup() only ever reads `ref` as an
 * opaque string key — it does not require refs to be non-uuid.
 */
export function useExportBackup() {
  return useMutation({
    mutationFn: async (): Promise<ImportPayload> => {
      const supabase = createClient()

      const [teamsRes, roundTypesRes, talliesRes, matchesRes, settingsRes] =
        await Promise.all([
          supabase.from('teams').select('*'),
          supabase.from('round_types').select('*'),
          supabase.from('pair_tallies').select('*'),
          supabase
            .from('matches')
            .select('*, rounds(*)')
            .order('created_at'),
          supabase.from('settings').select('*').maybeSingle(),
        ])

      for (const res of [teamsRes, roundTypesRes, talliesRes, matchesRes, settingsRes]) {
        if (res.error) throw res.error
      }

      const teams: ImportTeam[] = (teamsRes.data ?? []).map((team) => ({
        ref: team.id,
        game: team.game,
        name: team.name,
      }))

      const round_types = (roundTypesRes.data ?? []).map((rt) => ({
        name: rt.name,
        winner_pts: rt.winner_pts,
        loser_pts: rt.loser_pts,
        is_default: rt.is_default,
        position: rt.position,
      }))

      const pair_tallies = (talliesRes.data ?? []).map((tally) => ({
        game: tally.game,
        low_ref: tally.low_team_id,
        high_ref: tally.high_team_id,
        low_stars: tally.low_stars,
        low_points: tally.low_points,
        high_stars: tally.high_stars,
        high_points: tally.high_points,
      }))

      const matches: ImportMatch[] = ((matchesRes.data ?? []) as MatchWithRounds[]).map(
        (match) => ({
          game: match.game,
          status: match.status,
          team1_ref: match.team1_id,
          team2_ref: match.team2_id,
          target_points: match.target_points,
          winner_ref: match.winner_team_id,
          finished_at: match.finished_at,
          rounds: [...match.rounds]
            .sort((a, b) => a.position - b.position)
            .map((round) => ({
              position: round.position,
              t1_points: round.t1_points,
              t2_points: round.t2_points,
              winner_ref: round.winner_team_id,
              winner_pts: round.winner_pts,
              note: round.note,
            })),
        }),
      )

      const settings = settingsRes.data
        ? {
            cards_points_rollover: settingsRes.data.cards_points_rollover,
            domino_points_rollover: settingsRes.data.domino_points_rollover,
            domino_target: settingsRes.data.domino_target,
          }
        : undefined

      return { teams, round_types, pair_tallies, matches, settings }
    },

    onSuccess: (payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `score_keeper_backup_${new Date().toISOString().slice(0, 10)}.json`,
      })
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup exported successfully!')
    },

    onError: (error) => {
      toast.error(`Could not export backup. ${error.message}`)
    },
  })
}

/** Every cache keyed by game needs invalidating after an import replaces all data. */
const GAMES: GameType[] = ['cards', 'domino']

export function useImportBackup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (source: File | string): Promise<ParseResult> => {
      const raw = typeof source === 'string' ? source : await source.text()
      const result = parseBackupFile(raw)

      const supabase = createClient()
      const { error } = await supabase.rpc('import_backup', {
        p_payload: result.payload as never,
      })
      if (error) throw error

      return result
    },

    onSuccess: ({ dropped }) => {
      queryClient.invalidateQueries()

      const note =
        dropped.legacyRoundRegistries > 0
          ? ' Lifetime rounds-won counters were recomputed from imported matches; counts from matches not in your history could not be restored.'
          : ''
      toast.success(`Backup imported successfully!${note}`)

      for (const game of GAMES) {
        queryClient.invalidateQueries({ queryKey: ['leaderboard', game] })
      }
    },

    onError: (error) => {
      toast.error(`Could not import backup. ${error.message}`)
    },
  })
}
