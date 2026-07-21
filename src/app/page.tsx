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
    .select('game, rounds(id)')
    .eq('status', 'active')

  const hasRounds = (game: string) =>
    activeMatches?.some(
      (match) => match.game === game && match.rounds.length > 0,
    ) ?? false

  redirect(hasRounds('domino') && !hasRounds('cards') ? '/domino' : '/cards')
}
