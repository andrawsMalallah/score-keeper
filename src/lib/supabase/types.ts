/**
 * Database types, hand-written to match supabase/migrations/0001_init.sql.
 *
 * To regenerate from the live database instead (requires a Supabase access
 * token from https://supabase.com/dashboard/account/tokens):
 *   npx supabase login
 *   npx supabase gen types typescript --project-id ihbdsixulnyqxehpqtvg > src/lib/supabase/types.ts
 *
 * Keep this file in step with the migrations whenever the schema changes.
 */

export type GameType = 'cards' | 'domino'
export type MatchStatus = 'active' | 'finished'
export type Theme = 'auto' | 'light' | 'dark'

export interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          user_id: string
          theme: Theme
          cards_sub_rollover: number
          domino_sub_rollover: number
          domino_target: number
          updated_at: string
        }
        Insert: {
          user_id: string
          theme?: Theme
          cards_sub_rollover?: number
          domino_sub_rollover?: number
          domino_target?: number
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['settings']['Insert']>
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          user_id: string
          game: GameType
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          game: GameType
          name: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
        Relationships: []
      }
      round_types: {
        Row: {
          id: string
          user_id: string
          name: string
          /** Always negative: the winner's score for this round type. */
          winner_pts: number
          /** When set (>= 2) the loser's points are fixed, not entered by hand. */
          loser_pts: number | null
          is_default: boolean
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          winner_pts: number
          loser_pts?: number | null
          is_default?: boolean
          position?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['round_types']['Insert']>
        Relationships: []
      }
      matches: {
        Row: {
          id: string
          user_id: string
          game: GameType
          team1_id: string
          team2_id: string
          status: MatchStatus
          /** Domino only: points needed before a winner can be declared. */
          target_points: number | null
          winner_team_id: string | null
          created_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          game: GameType
          team1_id: string
          team2_id: string
          status?: MatchStatus
          target_points?: number | null
          winner_team_id?: string | null
          created_at?: string
          finished_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
        Relationships: []
      }
      rounds: {
        Row: {
          id: string
          match_id: string
          position: number
          t1_points: number
          t2_points: number
          winner_team_id: string
          /** Cards only: the round type's winner value used for this round. */
          winner_pts: number | null
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          position: number
          t1_points: number
          t2_points: number
          winner_team_id: string
          winner_pts?: number | null
          note?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['rounds']['Insert']>
        Relationships: []
      }
      pair_tallies: {
        Row: {
          id: string
          user_id: string
          game: GameType
          /** Always the lesser of the two team ids, so A-vs-B and B-vs-A share a row. */
          low_team_id: string
          high_team_id: string
          low_main: number
          low_sub: number
          high_main: number
          high_sub: number
        }
        Insert: {
          id?: string
          user_id?: string
          game: GameType
          low_team_id: string
          high_team_id: string
          low_main?: number
          low_sub?: number
          high_main?: number
          high_sub?: number
        }
        Update: Partial<Database['public']['Tables']['pair_tallies']['Insert']>
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          id: string
          user_id: string
          game: GameType
          name: string
          main_wins: number
          sub_wins: number
          rounds_won: number
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: {
      game_type: GameType
      match_status: MatchStatus
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Team = Tables<'teams'>
export type RoundType = Tables<'round_types'>
export type Match = Tables<'matches'>
export type Round = Tables<'rounds'>
export type PairTally = Tables<'pair_tallies'>
export type Settings = Tables<'settings'>
export type LeaderboardRow = PublicSchema['Views']['leaderboard']['Row']
