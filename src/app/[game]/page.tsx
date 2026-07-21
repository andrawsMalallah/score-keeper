import { notFound } from 'next/navigation'
import { getGameConfig, isGameType } from '@/lib/game/config'

/**
 * Setup screen. Section order is fixed by REBUILD.md §6.4:
 * slots → settings → team manager → history → leaderboard.
 *
 * Phase 4 replaces each placeholder with the real component; the order and the
 * shared-shell structure are what this phase establishes.
 */
export default async function GameSetupPage({
  params,
}: {
  params: Promise<{ game: string }>
}) {
  const { game } = await params
  if (!isGameType(game)) notFound()

  const config = getGameConfig(game)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[22px] font-bold text-bone">
          {config.label}
        </h1>
        <p className="mt-1 text-sm text-bone-dim">
          {config.winnerIs === 'lower'
            ? 'Lowest total wins.'
            : 'First to the target wins.'}
        </p>
      </div>

      <SetupSection title="Teams">
        <Placeholder>Team slots and team manager arrive in phase 4.</Placeholder>
      </SetupSection>

      <SetupSection title="Settings">
        <Placeholder>
          Rollover stepper
          {config.usesTarget && ', target picker'}
          {config.usesRoundTypes && ', round types'} arrive in phase 4.
        </Placeholder>
      </SetupSection>

      <SetupSection title="History">
        <Placeholder>Match history arrives in phase 6.</Placeholder>
      </SetupSection>

      <SetupSection title="Leaderboard">
        <Placeholder>Leaderboard arrives in phase 6.</Placeholder>
      </SetupSection>
    </div>
  )
}

function SetupSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-felt-700 bg-felt-800 p-4">
      <h2 className="font-display text-sm font-bold tracking-wide text-bone-dim uppercase">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-bone-dim">{children}</p>
}
