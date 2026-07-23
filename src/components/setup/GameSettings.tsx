'use client'

import type { GameType } from '@/lib/supabase/types'
import type { GameConfig } from '@/lib/game/config'
import { DEFAULT_POINTS_ROLLOVER } from '@/lib/game/tallies'
import {
  SETTINGS_BOUNDS,
  useSettings,
  useUpdateSettings,
} from '@/hooks/useSettings'
import { Stepper } from '@/components/ui/Stepper'

/**
 * Settings for one game. Which controls appear is driven by GameConfig rather
 * than by branching on the game name — only domino has a target, so only domino
 * shows a target picker.
 */
export function GameSettings({
  game,
  config,
}: {
  game: GameType
  config: GameConfig
}) {
  const { data: settings, isPending } = useSettings()
  const updateSettings = useUpdateSettings()

  if (isPending) {
    return <p className="text-sm text-muted">Loading settings…</p>
  }

  // The settings row is created on first change, so fall back to the same
  // defaults the migration declares.
  const rolloverColumn =
    game === 'cards' ? 'cards_points_rollover' : 'domino_points_rollover'
  const rollover = settings?.[rolloverColumn] ?? DEFAULT_POINTS_ROLLOVER
  const target = settings?.domino_target ?? 151

  return (
    <div className="space-y-5">
      <Stepper
        label="Points rollover"
        value={rollover}
        min={SETTINGS_BOUNDS.pointsRollover.min}
        max={SETTINGS_BOUNDS.pointsRollover.max}
        hint={`Every ${rollover} points become 1 star.`}
        onChange={(value) =>
          updateSettings.mutate({ [rolloverColumn]: value })
        }
      />

      {config.usesTarget && (
        <Stepper
          label="Target score"
          value={target}
          min={SETTINGS_BOUNDS.dominoTarget.min}
          max={SETTINGS_BOUNDS.dominoTarget.max}
          step={10}
          hint="A winner cannot be declared until a team reaches this score."
          onChange={(value) => updateSettings.mutate({ domino_target: value })}
        />
      )}
    </div>
  )
}
