'use client'

import { useEffect, useRef, useState } from 'react'
import { vibrate } from '@/lib/haptics'
import { AccountUpgrade } from './AccountUpgrade'
import { ImportExport } from './ImportExport'

/**
 * Overflow menu for actions that don't need to live in the nav at a glance
 * (import/export, save-your-data). Keeps GameTabs + ThemeToggle as the only
 * always-visible controls next to the brand.
 */
export function MoreMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          vibrate('selection')
          setOpen((value) => !value)
        }}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="More options"
          className="absolute top-full right-0 z-20 mt-2 flex min-w-40 flex-col gap-1 rounded-xl border border-border bg-surface p-2 shadow-lg motion-safe:animate-[menu-pop-in_120ms_ease-out]"
        >
          <ImportExport onAction={() => setOpen(false)} />
          <AccountUpgrade onAction={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
