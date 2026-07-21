import { describe, expect, it } from 'vitest'
import { defaultRoundTypeId, planRoundTypeDeletion } from './roundTypes'

const normal = { id: 'normal', is_default: true }
const double = { id: 'double', is_default: false }
const triple = { id: 'triple', is_default: false }

describe('planRoundTypeDeletion', () => {
  it('refuses to delete the last remaining round type', () => {
    expect(planRoundTypeDeletion([normal], 'normal')).toEqual({
      refusedBecause: 'last-remaining',
      promoteToDefaultId: null,
    })
  })

  it('allows deleting a non-default without touching the default', () => {
    expect(planRoundTypeDeletion([normal, double], 'double')).toEqual({
      refusedBecause: null,
      promoteToDefaultId: null,
    })
  })

  it('hands the default to a survivor when the default is deleted', () => {
    expect(planRoundTypeDeletion([normal, double, triple], 'normal')).toEqual({
      refusedBecause: null,
      promoteToDefaultId: 'double',
    })
  })

  it('promotes the first survivor in list order', () => {
    // The default sits in the middle, so the survivor is the one above it.
    const middleDefault = [
      { id: 'a', is_default: false },
      { id: 'b', is_default: true },
      { id: 'c', is_default: false },
    ]
    expect(planRoundTypeDeletion(middleDefault, 'b').promoteToDefaultId).toBe('a')
  })

  it('refuses the last one even when it is not the default', () => {
    // A single non-default entry is still the whole list.
    expect(
      planRoundTypeDeletion([double], 'double').refusedBecause,
    ).toBe('last-remaining')
  })
})

describe('defaultRoundTypeId', () => {
  it('returns null when there are no round types', () => {
    expect(defaultRoundTypeId([])).toBeNull()
  })

  it('picks the flagged default', () => {
    expect(defaultRoundTypeId([double, normal, triple])).toBe('normal')
  })

  it('falls back to the first entry when nothing is flagged', () => {
    // Should not happen while the unique index holds, but the form still needs
    // something selected rather than rendering an empty radio group.
    expect(defaultRoundTypeId([double, triple])).toBe('double')
  })
})
