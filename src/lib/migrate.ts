/**
 * Import/export for backup files (REBUILD.md §5).
 *
 * Two source formats exist:
 *  - "legacy": a flat `{ "cardGame_xxx": "<jsonString>" }` object, exactly
 *    what the old localStorage app's exportLocalStorageData() produced —
 *    every value is itself a JSON string, mirroring localStorage.getItem().
 *  - "current": the shape this app exports, already normalized.
 *
 * Both parse down to an ImportPayload, the exact shape import_backup(jsonb)
 * (supabase/migrations/0002_import_backup.sql) expects. Teams are addressed
 * by a caller-chosen `ref` string rather than a real id, because legacy data
 * has no ids at all (teams were just name strings) and even the current
 * export format shouldn't leak this account's ids into a file that might be
 * imported into a different account.
 */

export type BackupFormat = 'legacy' | 'current' | 'invalid'

export interface ImportTeam {
  ref: string
  game: 'cards' | 'domino'
  name: string
}

export interface ImportRoundType {
  name: string
  winner_pts: number
  loser_pts: number | null
  is_default: boolean
  position: number
}

export interface ImportRound {
  position: number
  t1_points: number
  t2_points: number
  winner_ref: string
  winner_pts: number | null
  note: string
}

export interface ImportMatch {
  game: 'cards' | 'domino'
  status: 'active' | 'finished'
  team1_ref: string
  team2_ref: string
  target_points: number | null
  winner_ref: string | null
  finished_at: string | null
  rounds: ImportRound[]
}

export interface ImportPairTally {
  game: 'cards' | 'domino'
  low_ref: string
  high_ref: string
  low_main: number
  low_sub: number
  high_main: number
  high_sub: number
}

export interface ImportSettings {
  cards_sub_rollover?: number
  domino_sub_rollover?: number
  domino_target?: number
}

export interface ImportPayload {
  teams: ImportTeam[]
  round_types: ImportRoundType[]
  pair_tallies: ImportPairTally[]
  matches: ImportMatch[]
  settings?: ImportSettings
}

/** Counters the old app kept as running totals; dropped rather than migrated. */
export interface DroppedCounts {
  /** `globalRoundsRegistry` / `domino_globalRoundsRegistry` entries. */
  legacyRoundRegistries: number
}

export interface ParseResult {
  payload: ImportPayload
  dropped: DroppedCounts
}

function ref(game: 'cards' | 'domino', name: string): string {
  return `${game}:${name}`
}

export function detectFormat(data: unknown): BackupFormat {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return 'invalid'
  }
  const keys = Object.keys(data as Record<string, unknown>)
  if (keys.length === 0) return 'invalid'

  if (keys.every((key) => key.startsWith('cardGame_'))) return 'legacy'
  if ('teams' in data && 'matches' in data) return 'current'
  return 'invalid'
}

/**
 * Parses the flat `cardGame_*` backup. Every value in the source object is a
 * JSON *string* (as produced by localStorage.getItem), so each key needs its
 * own JSON.parse before use — this mirrors loadXxx()/saveXxx() pairs in the
 * legacy app.js exactly, including its per-key fallbacks.
 */
export function parseLegacyBackup(data: Record<string, string>): ParseResult {
  const teams: ImportTeam[] = []
  const teamRefs = { cards: new Set<string>(), domino: new Set<string>() }

  const addTeam = (game: 'cards' | 'domino', name: string) => {
    const key = ref(game, name)
    if (teamRefs[game].has(name)) return
    teamRefs[game].add(name)
    teams.push({ ref: key, game, name })
  }

  const parseJson = <T,>(key: string, fallback: T): T => {
    const raw = data[key]
    if (!raw) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  // ── Teams ──────────────────────────────────────────────────────────
  // Old key predates per-game lists; cardsSavedTeams/dominoSavedTeams win
  // when present (mirrors the app.js migration at load time).
  const legacyShared = parseJson<string[]>('cardGame_savedTeams', [])
  const cardsTeams = parseJson<string[]>('cardGame_cardsSavedTeams', legacyShared)
  const dominoTeams = parseJson<string[]>('cardGame_dominoSavedTeams', legacyShared)
  cardsTeams.forEach((name) => addTeam('cards', name))
  dominoTeams.forEach((name) => addTeam('domino', name))

  // ── Round types (cards only) ──────────────────────────────────────
  const roundTypesRaw = parseJson<{
    types: Array<{
      name: string
      winnerPts?: number
      value?: number
      loserPts?: number | null
    }>
    defaultIndex?: number
  }>('cardGame_roundTypes', {
    types: [
      { name: 'Normal', winnerPts: -25, loserPts: null },
      { name: 'Double', winnerPts: -50, loserPts: 200 },
    ],
    defaultIndex: 0,
  })
  const defaultIndex = roundTypesRaw.defaultIndex ?? 0
  const round_types: ImportRoundType[] = roundTypesRaw.types.map((rt, index) => ({
    name: rt.name,
    winner_pts: rt.winnerPts ?? rt.value ?? -25,
    loser_pts: rt.loserPts ?? null,
    is_default: index === defaultIndex,
    position: index,
  }))

  // ── Pair tallies ───────────────────────────────────────────────────
  // Keys are "TeamA|||TeamB" (insertion order, not sorted); t1/t2 map to
  // whichever side of the key each team was on.
  const parseSideRegistry = (
    game: 'cards' | 'domino',
    key: string,
  ): ImportPairTally[] => {
    const registry = parseJson<
      Record<string, { t1Main: number; t1Sub: number; t2Main: number; t2Sub: number }>
    >(key, {})
    return Object.entries(registry).flatMap(([pairKey, counts]) => {
      const [nameA, nameB] = pairKey.split('|||')
      if (!nameA || !nameB) return []
      addTeam(game, nameA)
      addTeam(game, nameB)
      const refA = ref(game, nameA)
      const refB = ref(game, nameB)
      const teamA = { main: counts.t1Main, sub: counts.t1Sub }
      const teamB = { main: counts.t2Main, sub: counts.t2Sub }
      const [low_ref, high_ref, low, high] =
        refA < refB ? [refA, refB, teamA, teamB] : [refB, refA, teamB, teamA]
      return [
        {
          game,
          low_ref,
          high_ref,
          low_main: low.main,
          low_sub: low.sub,
          high_main: high.main,
          high_sub: high.sub,
        },
      ]
    })
  }
  const pair_tallies: ImportPairTally[] = [
    ...parseSideRegistry('cards', 'cardGame_globalSideRegistry'),
    ...parseSideRegistry('domino', 'cardGame_domino_globalSideRegistry'),
  ]

  // ── Match history (finished matches) ──────────────────────────────
  interface LegacyRound {
    t1: number
    t2: number
    winnerTeam?: string
    winner?: string
    winnerPts?: number
    note?: string
  }
  interface LegacyMatch {
    date: string
    team1: string
    team2: string
    winner: string
    roundCount: number
    rounds: LegacyRound[]
  }

  const toImportRounds = (
    game: 'cards' | 'domino',
    rounds: LegacyRound[],
  ): ImportRound[] =>
    rounds.map((round, position) => {
      const winnerName = round.winnerTeam ?? round.winner ?? ''
      addTeam(game, winnerName)
      return {
        position,
        t1_points: round.t1,
        t2_points: round.t2,
        winner_ref: ref(game, winnerName),
        winner_pts: game === 'cards' ? (round.winnerPts ?? null) : null,
        note: round.note ?? '',
      }
    })

  const toImportMatch = (
    game: 'cards' | 'domino',
    match: LegacyMatch,
    status: 'active' | 'finished',
  ): ImportMatch => {
    addTeam(game, match.team1)
    addTeam(game, match.team2)
    return {
      game,
      status,
      team1_ref: ref(game, match.team1),
      team2_ref: ref(game, match.team2),
      target_points: null,
      winner_ref: status === 'finished' ? ref(game, match.winner) : null,
      finished_at: status === 'finished' ? match.date : null,
      rounds: toImportRounds(game, match.rounds),
    }
  }

  const cardsHistory = parseJson<LegacyMatch[]>('cardGame_matchHistory', [])
  const dominoHistory = parseJson<LegacyMatch[]>('cardGame_domino_matchHistory', [])

  const matches: ImportMatch[] = [
    ...cardsHistory.map((match) => toImportMatch('cards', match, 'finished')),
    ...dominoHistory.map((match) => toImportMatch('domino', match, 'finished')),
  ]

  // ── Active (in-progress) matches ──────────────────────────────────
  const activeCards = parseJson<{
    t1Name?: string
    t2Name?: string
    rounds: LegacyRound[]
  } | null>('cardGame_activeGame', null)
  if (activeCards?.t1Name && activeCards?.t2Name) {
    addTeam('cards', activeCards.t1Name)
    addTeam('cards', activeCards.t2Name)
    matches.push({
      game: 'cards',
      status: 'active',
      team1_ref: ref('cards', activeCards.t1Name),
      team2_ref: ref('cards', activeCards.t2Name),
      target_points: null,
      winner_ref: null,
      finished_at: null,
      rounds: toImportRounds('cards', activeCards.rounds ?? []),
    })
  }

  const activeDomino = parseJson<{
    t1Name?: string
    t2Name?: string
    rounds: LegacyRound[]
    target?: number
  } | null>('cardGame_domino_activeGame', null)
  if (activeDomino?.t1Name && activeDomino?.t2Name) {
    addTeam('domino', activeDomino.t1Name)
    addTeam('domino', activeDomino.t2Name)
    matches.push({
      game: 'domino',
      status: 'active',
      team1_ref: ref('domino', activeDomino.t1Name),
      team2_ref: ref('domino', activeDomino.t2Name),
      target_points: null,
      winner_ref: null,
      finished_at: null,
      rounds: toImportRounds('domino', activeDomino.rounds ?? []),
    })
  }

  // ── Settings ───────────────────────────────────────────────────────
  const legacyRollover = parseInt(data['cardGame_subRollover'] ?? '', 10)
  const cardsRollover = parseInt(
    data['cardGame_cardsSubRollover'] ??
      (legacyRollover >= 2 ? String(legacyRollover) : '10'),
    10,
  )
  const dominoRollover = parseInt(
    data['cardGame_dominoSubRollover'] ??
      (legacyRollover >= 2 ? String(legacyRollover) : '10'),
    10,
  )
  const dominoTarget = parseInt(data['cardGame_dominoTarget'] ?? '151', 10)

  const settings: ImportSettings = {
    cards_sub_rollover: Number.isFinite(cardsRollover) ? cardsRollover : 10,
    domino_sub_rollover: Number.isFinite(dominoRollover) ? dominoRollover : 10,
    domino_target: Number.isFinite(dominoTarget) ? dominoTarget : 151,
  }

  // globalRoundsRegistry / domino_globalRoundsRegistry are lifetime
  // rounds-won counters. The new schema derives rounds_won from `rounds`
  // rows instead (REBUILD.md's "never stored" rule), so these are dropped —
  // counts for matches whose rounds weren't saved in history are lost.
  const legacyRoundsRegistry = parseJson<Record<string, number>>(
    'cardGame_globalRoundsRegistry',
    {},
  )
  const legacyDominoRoundsRegistry = parseJson<Record<string, number>>(
    'cardGame_domino_globalRoundsRegistry',
    {},
  )
  const legacyRoundRegistries =
    Object.keys(legacyRoundsRegistry).length +
    Object.keys(legacyDominoRoundsRegistry).length

  return {
    payload: { teams, round_types, pair_tallies, matches, settings },
    dropped: { legacyRoundRegistries },
  }
}

/**
 * Parses this app's own export format, which is already an ImportPayload —
 * re-exported as a function (rather than an identity alias) so call sites
 * don't need to know the two formats collapse to the same parse step.
 */
export function parseCurrentBackup(data: ImportPayload): ParseResult {
  return { payload: data, dropped: { legacyRoundRegistries: 0 } }
}

export function parseBackupFile(raw: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  const format = detectFormat(data)
  if (format === 'legacy') {
    return parseLegacyBackup(data as Record<string, string>)
  }
  if (format === 'current') {
    return parseCurrentBackup(data as ImportPayload)
  }
  throw new Error('That file is not a recognized Score Keeper backup.')
}
