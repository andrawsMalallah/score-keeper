import { type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

// Next.js 16 renamed the `middleware` convention to `proxy`. The runtime is
// always nodejs here and cannot be configured.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
