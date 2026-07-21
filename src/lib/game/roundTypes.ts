/**
 * Rules governing the cards round-type list (§2.3).
 *
 * Pure and separate from the hooks so the awkward cases — deleting the default,
 * deleting the last one — are unit-testable without a database.
 */

/** The subset these rules need; narrower than the database row. */
export interface DeletableRoundType {
  id: string
  is_default: boolean
}

export type DeleteRefusal = 'last-remaining'

export interface DeletePlan {
  /** Null when the delete is allowed. */
  refusedBecause: DeleteRefusal | null
  /**
   * Round type that must become the default first, when deleting the current
   * one. Null when the default is unaffected.
   */
  promoteToDefaultId: string | null
}

/**
 * Whether a round type can be deleted, and what else must happen if it can.
 *
 * Two rules interact here: the list can never be empty, and exactly one entry
 * is always the default. Deleting the default therefore has to hand the flag to
 * a survivor, or the game would start with nothing selected.
 */
export function planRoundTypeDeletion(
  roundTypes: readonly DeletableRoundType[],
  id: string,
): DeletePlan {
  if (roundTypes.length <= 1) {
    return { refusedBecause: 'last-remaining', promoteToDefaultId: null }
  }

  const target = roundTypes.find((type) => type.id === id)
  if (!target?.is_default) {
    return { refusedBecause: null, promoteToDefaultId: null }
  }

  // Promote the first survivor in list order, which is the one sitting closest
  // to the top of the managed list the user is looking at.
  const survivor = roundTypes.find((type) => type.id !== id)
  return {
    refusedBecause: null,
    promoteToDefaultId: survivor?.id ?? null,
  }
}

/**
 * The round type a new round should start on: the default, falling back to the
 * first entry so the form is never left with nothing selected.
 */
export function defaultRoundTypeId<T extends { id: string; is_default: boolean }>(
  roundTypes: readonly T[],
): string | null {
  if (roundTypes.length === 0) return null
  const preferred = roundTypes.find((type) => type.is_default)
  return (preferred ?? roundTypes[0]).id
}
