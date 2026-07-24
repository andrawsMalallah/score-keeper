/** Length of a generated account code, e.g. "7F3K9Q". */
export const CODE_LENGTH = 6

/**
 * Hidden domain for the synthetic email Supabase's password auth needs under
 * the hood. Never shown to the user — the code itself is the only credential
 * they ever see or type.
 */
export const CODE_EMAIL_DOMAIN = 'codelogin.local'

/**
 * Alphanumeric, uppercase, excluding characters that are easy to misread when
 * handwritten or read aloud: 0/O, 1/I/L.
 */
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A fresh random account code. Not a security secret in the cryptographic
 *  sense, but it is the sole account credential, so it draws from Web Crypto
 *  rather than Math.random() for a properly uniform distribution. */
export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => CODE_CHARSET[byte % CODE_CHARSET.length]).join('')
}

/**
 * The single normalization every call site must funnel a user-facing code
 * through before it touches Supabase. Two different things depend on this
 * matching exactly between signUp and signInWithPassword: the email (which
 * Supabase itself lowercases for lookup) and the password (which Supabase
 * does NOT normalize — unlike the email, a case mismatch here is a silent
 * wrong-password failure rather than something Supabase corrects for you).
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

/** Supabase lowercases emails internally for lookup; normalizeCode's casing
 *  doesn't matter here since this always lowercases again regardless. */
export function codeToEmail(code: string): string {
  return `${normalizeCode(code).toLowerCase()}@${CODE_EMAIL_DOMAIN}`
}

/** Local format check so obviously-bad input fails fast without a network round trip. */
export function isValidCodeFormat(input: string): boolean {
  const normalized = normalizeCode(input)
  if (normalized.length !== CODE_LENGTH) return false
  return [...normalized].every((char) => CODE_CHARSET.includes(char))
}
