import { createClient } from '@/lib/supabase/server'

/**
 * Temporary connection check. Replaced by the real setup screen in the next
 * phase; for now it proves session, RLS and the seed trigger all work.
 */
export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: roundTypes, error } = await supabase
    .from('round_types')
    .select('name, winner_pts, loser_pts, is_default')
    .order('position')

  return (
    <main className="mx-auto max-w-xl p-8 font-sans">
      <h1 className="text-2xl font-bold">Score Keeper</h1>
      <p className="mt-1 text-sm text-gray-500">Connection check</p>

      <dl className="mt-6 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-gray-500">Session</dt>
          <dd>{user ? (user.is_anonymous ? 'anonymous' : user.email) : 'none'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-500">User</dt>
          <dd className="font-mono text-xs">{user?.id ?? '—'}</dd>
        </div>
      </dl>

      <h2 className="mt-6 font-semibold">Seeded round types</h2>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {roundTypes?.map((rt) => (
            <li key={rt.name}>
              {rt.name} — winner {rt.winner_pts}
              {rt.loser_pts !== null && `, loser ${rt.loser_pts}`}
              {rt.is_default && ' (default)'}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
