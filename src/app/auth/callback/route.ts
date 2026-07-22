import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Completes an anonymous user's `updateUser({ email })` confirmation (see
 * useAccountUpgrade) so the upgrade finishes in place. Route Handlers, unlike
 * Server Components, can set cookies, so this is where the rotated session
 * actually lands.
 *
 * Supabase's default email template's {{ .ConfirmationURL }} verifies the
 * token on Supabase's own /verify endpoint and forwards here as
 * token_hash + type, not a PKCE `code` — verifyOtp, not
 * exchangeCodeForSession, is the call that actually consumes it. `code` is
 * kept as a fallback for projects configured for the PKCE flow instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/cards'

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}?upgraded=1`)
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}?upgraded=1`)
  }

  return NextResponse.redirect(`${origin}/cards?auth_error=1`)
}
