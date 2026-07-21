import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Launch rule from REBUILD.md §2.1: open Domino when it has an active match
 * with rounds and Cards does not; otherwise open Cards.
 *
 * The intent is resuming an interrupted game rather than a general preference —
 * an active domino match with no rounds yet is not worth interrupting the
 * default for, which is why the rounds check matters.
 */
export default async function Home() {
  const supabase = await createClient()

  const { data: activeMatches } = await supabase
    .from('matches')
    .select('id, game')
    .eq('status', 'active')

  // Which of those matches actually has rounds. Queried separately rather than
  // as an embedded join because the hand-written Database types carry no
  // relationship metadata, so `matches(rounds(id))` would not type-check.
  const activeIds = activeMatches?.map((match) => match.id) ?? []
  const { data: playedRounds } = activeIds.length
    ? await supabase.from('rounds').select('match_id').in('match_id', activeIds)
    : { data: [] }

  const matchesWithRounds = new Set(
    playedRounds?.map((round) => round.match_id) ?? [],
  )
  const hasRounds = (game: string) =>
    activeMatches?.some(
      (match) => match.game === game && matchesWithRounds.has(match.id),
    ) ?? false

  redirect(hasRounds('domino') && !hasRounds('cards') ? '/domino' : '/cards')
}
