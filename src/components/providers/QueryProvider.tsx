'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * The QueryClient is created inside state rather than at module scope on
 * purpose: a module-level client is shared across every request on the server,
 * which would leak one user's cached rows into another user's render.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Score entry happens live at a table and mutations are optimistic,
            // so the cache is already correct the instant a change is made.
            // A short stale window avoids refetching over the top of that.
            staleTime: 30_000,
            // The data is per-user and small; refetching on every window focus
            // is noise when a phone is being passed around the table.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
