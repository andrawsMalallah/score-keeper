'use client'

import { useEffect, useRef, useState } from 'react'
import { vibrate } from '@/lib/haptics'
import { AccountUpgrade, AccountUpgradeTrigger } from './AccountUpgrade'
import { ImportExport } from './ImportExport'

/**
 * Overflow menu for actions that don't need to live in the nav at a glance
 * (import/export, save-your-data). Keeps GameTabs + ThemeToggle as the only
 * always-visible controls next to the brand.
 */
export function MoreMenu() {
  const [open, setOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
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
        className="flex size-[34px] items-center justify-center rounded-full border border-border bg-surface text-sm text-muted transition-colors hover:text-fg"
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
          <AccountUpgradeTrigger
            onOpen={() => setUpgradeOpen(true)}
            onAction={() => setOpen(false)}
          />
        </div>
      )}

      {/*
       * Rendered outside the `open &&` block, at a fixed position, so closing
       * the menu (onAction above) doesn't unmount this and its <dialog> in
       * the same commit that upgradeOpen flips to true — the same class of
       * bug documented for VictoryModal in PlayScreen. `open` is state owned
       * here, not inside AccountUpgrade, so it survives the menu closing.
       */}
      <AccountUpgrade open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  )
}
