'use client'

import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useExportBackup, useImportBackup } from '@/hooks/useBackup'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

/**
 * Import/Export buttons (§2.1), visible only on setup screens — hidden on
 * /[game]/play, where the top bar instead shows the match-in-progress badge.
 * TopBar is rendered from the shared [game]/layout.tsx server component, so
 * route-awareness has to happen client-side via the pathname rather than a
 * prop threaded down from the layout.
 */
export function ImportExport() {
  const pathname = usePathname()
  const exportBackup = useExportBackup()
  const importBackup = useImportBackup()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const isSetupScreen = /^\/(cards|domino)\/?$/.test(pathname)
  if (!isSetupScreen) return null

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        onClick={() => exportBackup.mutate()}
        disabled={exportBackup.isPending}
      >
        Export
      </Button>
      <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) setPendingFile(file)
        }}
      />

      <ConfirmDialog
        open={pendingFile !== null}
        title="Import backup?"
        body="This replaces all teams, matches, tallies and settings for both games with the contents of this file. This cannot be undone."
        confirmLabel="Import"
        destructive
        onCancel={() => setPendingFile(null)}
        onConfirm={() => {
          if (!pendingFile) return
          const file = pendingFile
          setPendingFile(null)
          importBackup.mutate(file, {
            onSuccess: () => {
              // A full reload is simplest and matches the old app: every
              // query cache, active-match redirect and setup screen needs to
              // reflect entirely new ids after a wholesale data replacement.
              window.location.reload()
            },
          })
        }}
      />
    </div>
  )
}
