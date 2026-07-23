import { describe, expect, it } from 'vitest'

import {
  detectFormat,
  parseBackupFile,
  parseLegacyBackup,
  type ImportPayload,
} from './migrate'

describe('detectFormat', () => {
  it('recognizes a legacy flat cardGame_ backup', () => {
    expect(detectFormat({ cardGame_cardsSavedTeams: '["Alpha"]' })).toBe(
      'legacy',
    )
  })

  it('recognizes the current export shape', () => {
    expect(detectFormat({ teams: [], matches: [] })).toBe('current')
  })

  it('rejects an empty object', () => {
    expect(detectFormat({})).toBe('invalid')
  })

  it('rejects arrays and primitives', () => {
    expect(detectFormat([])).toBe('invalid')
    expect(detectFormat('hello')).toBe('invalid')
    expect(detectFormat(null)).toBe('invalid')
  })

  it('rejects an object with unrecognized keys', () => {
    expect(detectFormat({ foo: 'bar' })).toBe('invalid')
  })
})

describe('parseLegacyBackup', () => {
  it('parses saved teams per game', () => {
    const { payload } = parseLegacyBackup({
      cardGame_cardsSavedTeams: JSON.stringify(['Alpha', 'Bravo']),
      cardGame_dominoSavedTeams: JSON.stringify(['Charlie']),
    })

    expect(payload.teams).toEqual([
      { ref: 'cards:Alpha', game: 'cards', name: 'Alpha' },
      { ref: 'cards:Bravo', game: 'cards', name: 'Bravo' },
      { ref: 'domino:Charlie', game: 'domino', name: 'Charlie' },
    ])
  })

  it('falls back to the pre-split savedTeams key for both games', () => {
    const { payload } = parseLegacyBackup({
      cardGame_savedTeams: JSON.stringify(['Alpha', 'Bravo']),
    })

    expect(payload.teams.filter((t) => t.game === 'cards')).toHaveLength(2)
    expect(payload.teams.filter((t) => t.game === 'domino')).toHaveLength(2)
  })

  it('parses round types and marks the default by index', () => {
    const { payload } = parseLegacyBackup({
      cardGame_roundTypes: JSON.stringify({
        types: [
          { name: 'Normal', winnerPts: -25, loserPts: null },
          { name: 'Double', winnerPts: -50, loserPts: 200 },
        ],
        defaultIndex: 1,
      }),
    })

    expect(payload.round_types).toEqual([
      {
        name: 'Normal',
        winner_pts: -25,
        loser_pts: null,
        is_default: false,
        position: 0,
      },
      {
        name: 'Double',
        winner_pts: -50,
        loser_pts: 200,
        is_default: true,
        position: 1,
      },
    ])
  })

  it('migrates the old value-only round type field', () => {
    const { payload } = parseLegacyBackup({
      cardGame_roundTypes: JSON.stringify({
        types: [{ name: 'Legacy', value: -30 }],
        defaultIndex: 0,
      }),
    })

    expect(payload.round_types[0]).toMatchObject({
      name: 'Legacy',
      winner_pts: -30,
      loser_pts: null,
    })
  })

  it('splits "A|||B" side-registry keys into normalized low/high tallies', () => {
    const { payload } = parseLegacyBackup({
      cardGame_globalSideRegistry: JSON.stringify({
        'Bravo|||Alpha': { t1Main: 2, t1Sub: 3, t2Main: 5, t2Sub: 1 },
      }),
    })

    // "Alpha" < "Bravo" lexicographically, so Alpha must land in the low_*
    // columns even though it was t2 in the source key.
    expect(payload.pair_tallies).toEqual([
      {
        game: 'cards',
        low_ref: 'cards:Alpha',
        high_ref: 'cards:Bravo',
        low_stars: 5,
        low_points: 1,
        high_stars: 2,
        high_points: 3,
      },
    ])
  })

  it('parses finished match history into archived matches with rounds', () => {
    const { payload } = parseLegacyBackup({
      cardGame_matchHistory: JSON.stringify([
        {
          date: '2026-01-01T00:00:00.000Z',
          team1: 'Alpha',
          team2: 'Bravo',
          winner: 'Alpha',
          t1Total: -25,
          t2Total: 40,
          roundCount: 1,
          rounds: [
            { t1: -25, t2: 40, winnerTeam: 'Alpha', winnerPts: -25, note: 'gin' },
          ],
        },
      ]),
    })

    expect(payload.matches).toEqual([
      {
        game: 'cards',
        status: 'finished',
        team1_ref: 'cards:Alpha',
        team2_ref: 'cards:Bravo',
        target_points: null,
        winner_ref: 'cards:Alpha',
        finished_at: '2026-01-01T00:00:00.000Z',
        rounds: [
          {
            position: 0,
            t1_points: -25,
            t2_points: 40,
            winner_ref: 'cards:Alpha',
            winner_pts: -25,
            note: 'gin',
          },
        ],
      },
    ])
  })

  it('parses an in-progress active game as a match with status active', () => {
    const { payload } = parseLegacyBackup({
      cardGame_activeGame: JSON.stringify({
        t1Name: 'Alpha',
        t2Name: 'Bravo',
        rounds: [{ t1: -25, t2: 30, winnerTeam: 'Alpha', note: '' }],
      }),
    })

    expect(payload.matches).toHaveLength(1)
    expect(payload.matches[0]).toMatchObject({
      status: 'active',
      finished_at: null,
      winner_ref: null,
    })
  })

  it('carries the domino target into settings and rounds have no winner_pts', () => {
    const { payload } = parseLegacyBackup({
      cardGame_dominoTarget: '200',
      cardGame_domino_activeGame: JSON.stringify({
        t1Name: 'Alpha',
        t2Name: 'Bravo',
        rounds: [{ t1: 40, t2: 0, winnerTeam: 'Alpha', note: '' }],
        target: 200,
      }),
    })

    expect(payload.settings?.domino_target).toBe(200)
    expect(payload.matches[0].rounds[0].winner_pts).toBeNull()
  })

  it('falls back to the legacy shared rollover for both games', () => {
    const { payload } = parseLegacyBackup({
      cardGame_subRollover: '5',
    })

    expect(payload.settings).toEqual({
      cards_points_rollover: 5,
      domino_points_rollover: 5,
      domino_target: 151,
    })
  })

  it('reports dropped legacy rounds-won registries without importing them', () => {
    const { dropped, payload } = parseLegacyBackup({
      cardGame_globalRoundsRegistry: JSON.stringify({ Alpha: 12, Bravo: 4 }),
      cardGame_domino_globalRoundsRegistry: JSON.stringify({ Alpha: 3 }),
    })

    expect(dropped.legacyRoundRegistries).toBe(3)
    // Nothing in ImportPayload carries a rounds-won counter at all.
    expect(payload).not.toHaveProperty('rounds_won')
  })

  it('ignores an unparsable value for a single key rather than throwing', () => {
    expect(() =>
      parseLegacyBackup({ cardGame_matchHistory: 'not json' }),
    ).not.toThrow()
  })
})

describe('parseBackupFile', () => {
  it('throws on invalid JSON', () => {
    expect(() => parseBackupFile('{not json')).toThrow(/not valid JSON/)
  })

  it('throws on a JSON file that matches neither format', () => {
    expect(() => parseBackupFile(JSON.stringify({ foo: 'bar' }))).toThrow(
      /not a recognized/,
    )
  })

  it('round-trips the current export format unchanged', () => {
    const payload: ImportPayload = {
      teams: [{ ref: 'cards:Alpha', game: 'cards', name: 'Alpha' }],
      round_types: [],
      pair_tallies: [],
      matches: [],
    }

    const { payload: parsed } = parseBackupFile(JSON.stringify(payload))
    expect(parsed).toEqual(payload)
  })
})
