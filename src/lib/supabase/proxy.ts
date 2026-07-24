import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from './types'

/**
 * Refreshes the Supabase session on every request and forwards the rotated
 * auth cookies to both the request (for Server Components rendered in this
 * pass) and the response (for the browser).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Contacts the auth server to validate the token and rotate the session
  // cookie for real code accounts. Do not replace with getSession(), which
  // trusts unverified cookie data. An unauthenticated request simply passes
  // through with no user — AuthGate renders the code entry screen for that
  // case, and RLS returns empty results rather than erroring.
  await supabase.auth.getUser()

  return supabaseResponse
}
