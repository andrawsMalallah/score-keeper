'use client'

import { useEffect } from 'react'
import { useImportBackup } from '@/hooks/useBackup'
import { toast } from '@/stores/toasts'

const DISMISSED_KEY = 'cardGame_importOfferDismissed'

function readLegacyData(): string | null {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('cardGame_') && key !== DISMISSED_KEY) {
      data[key] = localStorage.getItem(key) as string
    }
  }
  return Object.keys(data).length > 0 ? JSON.stringify(data) : null
}

function clearLegacyKeys() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.startsWith('cardGame_')) localStorage.removeItem(key)
  }
}

/**
 * First-run offer (§5.1): if this browser has old localStorage data and the
 * signed-in account hasn't already been offered it, show a toast with an
 * action button that imports it via the same import_backup path as a file
 * upload — the browser IS the backup file here, so parseLegacyBackup reads
 * straight off localStorage instead of a File.
 *
 * Mounted once from the setup screen (not the play screen) so it never
 * interrupts a live match.
 */
export function LegacyDataOffer() {
  const importBackup = useImportBackup()

  // Runs once on mount. The empty dependency array is deliberate: this is a
  // one-time check of an external system (localStorage), not something that
  // should re-run as component state changes.
  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return
    const raw = readLegacyData()
    if (!raw) return

    toast.info('Old score keeper data was found on this device.', {
      label: 'Bring it into your account',
      onClick: () => {
        importBackup.mutate(raw, {
          onSuccess: () => {
            clearLegacyKeys()
            window.location.reload()
          },
        })
      },
    })
    localStorage.setItem(DISMISSED_KEY, '1')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
