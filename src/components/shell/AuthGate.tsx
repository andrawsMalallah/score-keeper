'use client'

import { useHasSession } from '@/hooks/useCodeAuth'
import { CodeAuthScreen } from './CodeAuthScreen'

/**
 * Gates the entire app behind a code account. Sits inside QueryProvider at
 * the root layout, above src/app/page.tsx's redirect logic and [game]/layout —
 * by the time either renders, a session is guaranteed to exist, so neither
 * needs its own gating check.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: hasSession, isPending } = useHasSession()

  if (isPending) return null
  if (!hasSession) return <CodeAuthScreen />

  return <>{children}</>
}
