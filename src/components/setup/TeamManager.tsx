'use client'

import { useState } from 'react'
import type { GameType } from '@/lib/supabase/types'
import {
  isDuplicateName,
  useAddTeam,
  useDeleteTeam,
  useRenameTeam,
  useTeams,
  type Team,
} from '@/hooks/useTeams'
import { useUiStore } from '@/stores/ui'
import { toast } from '@/stores/toasts'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export function TeamManager({ game }: { game: GameType }) {
  const { data: teams, isPending } = useTeams(game)
  const addTeam = useAddTeam(game)
  const renameTeam = useRenameTeam(game)
  const deleteTeam = useDeleteTeam(game)

  const slots = useUiStore((state) => state.slots[game])
  const assignToSlot = useUiStore((state) => state.assignToSlot)
  const removeTeamFromSlots = useUiStore((state) => state.removeTeamFromSlots)

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Team | null>(null)

  function handleAdd() {
    const name = newName.trim()
    if (!name) {
      toast.error('Enter a team name.')
      return
    }
    if (isDuplicateName(teams, name)) {
      toast.error(`"${name}" already exists in ${game}.`)
      return
    }

    addTeam.mutate(name)
    setNewName('')
  }

  function handleCardTap(team: Team) {
    const result = assignToSlot(game, team.id)
    if (result === 'full') {
      toast.info('Both slots are taken. Clear one first.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <label htmlFor="new-team" className="sr-only">
          New team name
        </label>
        <input
          id="new-team"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
          placeholder="Add a team"
          maxLength={40}
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted"
        />
        <Button variant="primary" onClick={handleAdd}>
          Add
        </Button>
      </div>

      {isPending ? (
        <p className="text-sm text-muted">Loading teams…</p>
      ) : teams && teams.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              slotIndex={slots.indexOf(team.id)}
              isEditing={editingId === team.id}
              onTap={() => handleCardTap(team)}
              onStartEdit={() => setEditingId(team.id)}
              onCancelEdit={() => setEditingId(null)}
              onRename={(name) => {
                if (name === team.name) {
                  setEditingId(null)
                  return
                }
                if (isDuplicateName(teams, name, team.id)) {
                  toast.error(`"${name}" already exists in ${game}.`)
                  return
                }
                renameTeam.mutate({ id: team.id, name })
                setEditingId(null)
              }}
              onDelete={() => setPendingDelete(team)}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-fg">No teams saved</p>
          <p className="mt-1 text-xs text-muted">
            Add teams above to get started.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name}?`}
        body="This also removes the team's tallies, match history and rounds won. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          // Clear the slot first: a deleted team left staged would render as an
          // empty slot that still blocks the other one.
          removeTeamFromSlots(pendingDelete.id)
          deleteTeam.mutate(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

interface TeamCardProps {
  team: Team
  /** -1 when unassigned, otherwise which slot holds it. */
  slotIndex: number
  isEditing: boolean
  onTap: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

function TeamCard({
  team,
  slotIndex,
  isEditing,
  onTap,
  onStartEdit,
  onCancelEdit,
  onRename,
  onDelete,
}: TeamCardProps) {
  const assignedStyle =
    slotIndex === 0
      ? 'border-team1 bg-team1/10'
      : slotIndex === 1
        ? 'border-team2 bg-team2/10'
        : 'border-border bg-bg'

  if (isEditing) {
    return (
      <li className={`rounded-lg border p-2 ${assignedStyle}`}>
        <RenameForm
          team={team}
          onSubmit={onRename}
          onCancel={onCancelEdit}
        />
      </li>
    )
  }

  return (
    <li className={`rounded-lg border transition-colors ${assignedStyle}`}>
      <div className="flex items-center gap-1 p-2">
        {/* The whole card is the assign target, so it is the button. The edit
            and delete controls sit outside it to stay independently reachable. */}
        <button
          type="button"
          onClick={onTap}
          aria-pressed={slotIndex >= 0}
          className="flex-1 truncate text-left text-sm text-fg"
        >
          {team.name}
        </button>

        <button
          type="button"
          onClick={onStartEdit}
          aria-label={`Rename ${team.name}`}
          className="rounded px-1 text-xs text-muted hover:text-fg"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${team.name}`}
          className="rounded px-1 text-xs text-muted hover:text-danger"
        >
          ✕
        </button>
      </div>
    </li>
  )
}

/**
 * Split out so the draft state initialises from props on mount rather than
 * being reset by an effect. TeamCard renders this only while editing, so
 * entering edit mode mounts a fresh copy already holding the current name.
 */
function RenameForm({
  team,
  onSubmit,
  onCancel,
}: {
  team: Team
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(team.name)

  return (
    <>
      <label htmlFor={`rename-${team.id}`} className="sr-only">
        Rename {team.name}
      </label>
      <input
        id={`rename-${team.id}`}
        // Pre-filled and selected on open (§2.2), so replacing the whole name —
        // the common case — takes a single keystroke.
        autoFocus
        onFocus={(event) => event.target.select()}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit(draft.trim())
          if (event.key === 'Escape') onCancel()
        }}
        maxLength={40}
        className="w-full rounded border border-border bg-bg px-2 py-1 text-sm text-fg"
      />
      <div className="mt-1 flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel rename"
          className="rounded px-1 text-xs text-muted hover:text-fg"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => onSubmit(draft.trim())}
          aria-label="Save name"
          className="rounded px-1 text-xs text-accent"
        >
          ✓
        </button>
      </div>
    </>
  )
}
