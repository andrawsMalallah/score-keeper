import { notFound } from 'next/navigation'
import { isGameType } from '@/lib/game/config'
import { PlayScreen } from '@/components/play/PlayScreen'

/**
 * Live match screen. The active match is fetched client-side so the round
 * mutations and the screen read from the same TanStack Query cache — a server
 * fetch here would render from a snapshot the optimistic updates then diverge
 * from.
 */
export default async function PlayPage({
  params,
}: {
  params: Promise<{ game: string }>
}) {
  const { game } = await params
  if (!isGameType(game)) notFound()

  return <PlayScreen game={game} />
}
