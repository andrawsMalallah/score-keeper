import { notFound } from 'next/navigation'
import { isGameType } from '@/lib/game/config'
import { TopBar } from '@/components/shell/TopBar'

/**
 * The shared shell for both games. Cards and domino differ only by the config
 * the route param resolves to — never by having their own layout.
 *
 * Next 16 delivers params as a promise, so this must await them.
 */
export default async function GameLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ game: string }>
}) {
  const { game } = await params

  // The param arrives as an untrusted string from the URL; anything that is not
  // a real game is a 404 rather than a crash deeper in the tree.
  if (!isGameType(game)) notFound()

  return (
    <>
      <TopBar activeGame={game} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </>
  )
}

/** Both games are known ahead of time, so they can be prerendered. */
export function generateStaticParams() {
  return [{ game: 'cards' }, { game: 'domino' }]
}
