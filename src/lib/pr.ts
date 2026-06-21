import { calculateOneRm } from './one-rm'

export interface ExercisePRRecord {
  maxWeight: number
  max1Rm: number
  maxWeightByReps: Map<number, number>
}

/**
 * Calculates PR records for all exercises based on a list of completed workout sets.
 */
export function calculateExercisePRRecords(
  sets: Array<{
    exercise_id: string
    weight_kg: number | string
    reps: number
    rir: number
    is_warmup: boolean
    workout?: { completed_at?: string | null } | null
  }>,
  beforeDate?: string | null
): Map<string, ExercisePRRecord> {
  const records = new Map<string, ExercisePRRecord>()

  for (const s of sets) {
    if (s.is_warmup) continue
    const weight = Number(s.weight_kg)
    if (weight <= 0 || s.reps <= 0) continue

    // If beforeDate is provided, filter out sets from workouts completed at or after this date
    if (beforeDate) {
      const completedAt = s.workout?.completed_at
      if (!completedAt || completedAt >= beforeDate) {
        continue
      }
    }

    let rec = records.get(s.exercise_id)
    if (!rec) {
      rec = {
        maxWeight: 0,
        max1Rm: 0,
        maxWeightByReps: new Map<number, number>(),
      }
      records.set(s.exercise_id, rec)
    }

    // Update max weight
    if (weight > rec.maxWeight) {
      rec.maxWeight = weight
    }

    // Update max weight for reps
    const currentMaxForReps = rec.maxWeightByReps.get(s.reps) ?? 0
    if (weight > currentMaxForReps) {
      rec.maxWeightByReps.set(s.reps, weight)
    }

    // Update max 1RM
    const oneRm = calculateOneRm({ weightKg: weight, reps: s.reps, rir: s.rir }).recommended
    if (oneRm > rec.max1Rm) {
      rec.max1Rm = oneRm
    }
  }

  return records
}

/**
 * Checks if a given set is a PR compared to a historical record.
 *
 * A PR is determined SOLELY by estimated 1RM — the single metric that
 * unifies weight, reps, and RIR into one comparable number.
 * Additional reasons (rep-max, absolute weight) are added only when the 1RM
 * condition is also met, to provide context in the toast message.
 */
export function checkIsPR(
  set: { weight_kg: number; reps: number; rir: number; is_warmup: boolean },
  record: ExercisePRRecord | undefined
): { isPR: boolean; reasons: string[] } {
  if (set.is_warmup || set.weight_kg <= 0 || set.reps <= 0) {
    return { isPR: false, reasons: [] }
  }

  if (!record) {
    // If no history exists, it's a PR!
    return { isPR: true, reasons: ['First time performing exercise'] }
  }

  const oneRm = calculateOneRm({ weightKg: set.weight_kg, reps: set.reps, rir: set.rir }).recommended
  const reasons: string[] = []

  // Primary criterion: Estimated 1RM must exceed historical best
  if (oneRm > record.max1Rm) {
    reasons.push(`Estimated 1RM PR (${oneRm} kg > ${record.max1Rm} kg)`)

    // Add extra context reasons (only when 1RM is a PR)
    const prevMaxForReps = record.maxWeightByReps.get(set.reps) ?? 0
    if (prevMaxForReps > 0 && set.weight_kg > prevMaxForReps) {
      reasons.push(`${set.reps}-Rep Max PR (${set.weight_kg} kg > ${prevMaxForReps} kg)`)
    }

    if (set.weight_kg > record.maxWeight) {
      reasons.push(`Absolute Weight PR (${set.weight_kg} kg > ${record.maxWeight} kg)`)
    }
  }

  return {
    isPR: reasons.length > 0,
    reasons,
  }
}

/**
 * Processes a list of workout sets and returns a Set of set numbers that are PRs.
 *
 * Only the SINGLE BEST set in the workout can be a PR. The best set is determined by:
 *   1. Highest estimated 1RM (primary)
 *   2. Highest weight used (tiebreaker when 1RM is equal)
 *
 * That best set is only marked as PR if it strictly exceeds the historical best 1RM.
 * This means at most ONE set per exercise per workout gets the PR label.
 */
export function identifyPRsInWorkout(
  workoutSets: Array<{
    id?: string
    set_number: number
    weight_kg: number | string
    reps: number
    rir: number
    is_warmup: boolean
  }>,
  historicalRecord: ExercisePRRecord | undefined
): Set<number> {
  const prSetNumbers = new Set<number>()
  const historicalMax1Rm = historicalRecord?.max1Rm ?? 0

  // Find the single best set in the workout
  let bestSetNumber: number | null = null
  let bestOneRm = 0
  let bestWeight = 0

  for (const s of workoutSets) {
    const weight = Number(s.weight_kg)
    if (s.is_warmup || weight <= 0 || s.reps <= 0) continue

    const oneRm = calculateOneRm({ weightKg: weight, reps: s.reps, rir: s.rir }).recommended

    // Pick this set if it has a higher 1RM, or same 1RM but heavier weight
    if (oneRm > bestOneRm || (oneRm === bestOneRm && weight > bestWeight)) {
      bestOneRm = oneRm
      bestWeight = weight
      bestSetNumber = s.set_number
    }
  }

  // Only mark the best set as PR if it strictly exceeds historical best
  if (bestSetNumber !== null && bestOneRm > historicalMax1Rm) {
    prSetNumbers.add(bestSetNumber)
  }

  return prSetNumbers
}
