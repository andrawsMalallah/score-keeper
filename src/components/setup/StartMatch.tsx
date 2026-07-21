'use client'

import { useRouter } from 'next/navigation'
import type { GameType } from '@/lib/supabase/types'
import type { GameConfig } from '@/lib/game/config'
import { useActiveMatch, useStartMatch } from '@/hooks/useMatch'
import { useSettings } from '@/hooks/useSettings'
import { useUiStore } from '@/stores/ui'
import { toast } from '@/stores/toasts'
import { Button } from '@/components/ui/Button'

/**
 * Starts a match from the two staged slots, or offers to resume one that is
 * already running — `matches_one_active` allows only one live match per game,
 * so starting another would fail at the database.
 */
export function StartMatch({
  game,
  config,
}: {
  game: GameType
  config: GameConfig
}) {
  const router = useRouter()
  const slots = useUiStore((state) => state.slots[game])
  const startMatch = useStartMatch(game)
  const { data: activeMatch } = useActiveMatch(game)
  const { data: settings } = useSettings()

  if (activeMatch) {
    return (
      <Button
        variant="primary"
        className="w-full"
        onClick={() => router.push(`/${game}/play`)}
      >
        Resume match
      </Button>
    )
  }

  const [team1Id, team2Id] = slots
  const ready = team1Id !== null && team2Id !== null

  function handleStart() {
    if (!team1Id || !team2Id) {
      toast.error('Pick a team for both slots first.')
      return
    }
    // The schema also rejects this, but a toast explains it better than a
    // constraint violation would.
    if (team1Id === team2Id) {
      toast.error('Pick two different teams.')
      return
    }

    startMatch.mutate(
      {
        team1Id,
        team2Id,
        targetPoints: config.usesTarget ? (settings?.domino_target ?? 151) : null,
      },
      { onSuccess: () => router.push(`/${game}/play`) },
    )
  }

  return (
    <Button
      variant="primary"
      className="w-full"
      onClick={handleStart}
      disabled={!ready || startMatch.isPending}
    >
      {ready ? 'Start game' : 'Pick two teams to start'}
    </Button>
  )
}
