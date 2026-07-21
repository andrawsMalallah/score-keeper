import { notFound } from 'next/navigation'
import { getGameConfig, isGameType } from '@/lib/game/config'
import { TeamSlots } from '@/components/setup/TeamSlots'
import { TeamManager } from '@/components/setup/TeamManager'
import { GameSettings } from '@/components/setup/GameSettings'
import { RoundTypeManager } from '@/components/setup/RoundTypeManager'

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
        <div className="space-y-4">
          <TeamSlots game={game} />
          <TeamManager game={game} />
        </div>
      </SetupSection>

      <SetupSection title="Settings">
        <GameSettings game={game} config={config} />
      </SetupSection>

      {/* Only cards scores rounds from named presets, so only cards gets this. */}
      {config.usesRoundTypes && (
        <SetupSection title="Round types">
          <RoundTypeManager />
        </SetupSection>
      )}

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
