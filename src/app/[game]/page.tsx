import { notFound } from 'next/navigation'
import { getGameConfig, isGameType } from '@/lib/game/config'
import { LegacyDataOffer } from '@/components/shell/LegacyDataOffer'
import { TeamSlots } from '@/components/setup/TeamSlots'
import { TeamManager } from '@/components/setup/TeamManager'
import { GameSettings } from '@/components/setup/GameSettings'
import { RoundTypeManager } from '@/components/setup/RoundTypeManager'
import { StartMatch } from '@/components/setup/StartMatch'
import { MatchHistory } from '@/components/setup/MatchHistory'
import { Leaderboard } from '@/components/setup/Leaderboard'
import { PairTallies } from '@/components/setup/PairTallies'
import { SetupSection } from '@/components/setup/SetupSection'

/**
 * Setup screen. Section order is fixed by REBUILD.md §6.4:
 * slots → settings → team manager → history → leaderboard.
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
      <LegacyDataOffer />

      <div>
        <h1 className="font-display text-[22px] font-bold text-fg">
          {config.label}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {config.winnerIs === 'lower'
            ? 'Lowest total wins.'
            : 'First to the target wins.'}
        </p>
      </div>

      <SetupSection title="Teams">
        <div className="space-y-4">
          <TeamSlots game={game} />
          <StartMatch game={game} config={config} />
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

      {/* MatchHistory renders its own card and hides it entirely when there
          are no archived matches yet (§2.8), unlike the other sections. */}
      <MatchHistory game={game} />

      <SetupSection title="Leaderboard">
        <Leaderboard game={game} />
      </SetupSection>

      <SetupSection title="Team Pairs">
        <PairTallies game={game} />
      </SetupSection>
    </div>
  )
}
