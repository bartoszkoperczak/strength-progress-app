export type SuggestionType = 'increase' | 'maintain' | 'decrease' | 'deload'

export interface ProgressionSuggestion {
  type: SuggestionType
  message: string
  exerciseId: string
  exerciseName: string
  /** Suggested weight in kg (only for 'increase' / 'decrease' types) */
  suggestedWeightKg?: number
}

export interface SessionSet {
  reps: number
  rir: number
  is_warmup: boolean
  weight_kg?: number
}

export interface SessionData {
  exerciseId: string
  exerciseName: string
  targetReps: number
  sets: SessionSet[]
  completedAt: string
}

export function evaluateSession(
  sets: SessionSet[],
  targetReps: number,
): { hitTarget: boolean; avgRir: number | null; maxWeight: number | null } {
  const working = sets.filter((s) => !s.is_warmup)
  if (working.length === 0) return { hitTarget: false, avgRir: null, maxWeight: null }

  const hitTarget = working.every((s) => s.reps >= targetReps)
  const avgRir = working.reduce((sum, s) => sum + s.rir, 0) / working.length
  const maxWeight = working.reduce((max, s) => Math.max(max, s.weight_kg ?? 0), 0) || null
  return { hitTarget, avgRir, maxWeight }
}

/**
 * Calculate a realistic weight increment based on the current weight.
 * Uses ~2% of current weight, rounded to the nearest plate increment (0.25 kg).
 * Clamped between 0.5 kg (minimum useful increase) and 2.5 kg (maximum single jump).
 */
export function calculateIncrement(currentWeightKg: number): number {
  if (currentWeightKg <= 0) return 1.25
  const raw = currentWeightKg * 0.02 // 2% increase
  const rounded = Math.round(raw * 4) / 4 // round to nearest 0.25
  return Math.max(0.5, Math.min(2.5, rounded))
}

/**
 * Round a weight to the nearest 0.25 kg plate increment.
 */
function roundToPlate(kg: number): number {
  return Math.round(kg * 4) / 4
}

export function getProgressionSuggestions(
  sessions: SessionData[],
  daysSinceLastWorkout: number | null,
): ProgressionSuggestion[] {
  const suggestions: ProgressionSuggestion[] = []

  if (daysSinceLastWorkout !== null && daysSinceLastWorkout > 14) {
    suggestions.push({
      type: 'deload',
      message: 'Consider a deload week (−10% weight) — over 14 days since last workout.',
      exerciseId: '_global',
      exerciseName: 'General',
    })
  }

  const byExercise = new Map<string, SessionData[]>()
  for (const session of sessions) {
    const list = byExercise.get(session.exerciseId) ?? []
    list.push(session)
    byExercise.set(session.exerciseId, list)
  }

  for (const [exerciseId, exerciseSessions] of byExercise) {
    const sorted = [...exerciseSessions].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )
    if (sorted.length < 2) continue

    const [latest, previous] = sorted
    const latestEval = evaluateSession(latest.sets, latest.targetReps)
    const prevEval = evaluateSession(previous.sets, previous.targetReps)

    // Increase: both sessions hit target reps AND average RIR >= 1
    // (lifter had reps in reserve — room to add weight)
    if (
      latestEval.hitTarget &&
      prevEval.hitTarget &&
      latestEval.avgRir !== null &&
      prevEval.avgRir !== null &&
      latestEval.avgRir >= 1 &&
      prevEval.avgRir >= 1
    ) {
      const currentWeight = latestEval.maxWeight
      if (currentWeight && currentWeight > 0) {
        const increment = calculateIncrement(currentWeight)
        const suggestedWeight = roundToPlate(currentWeight + increment)
        suggestions.push({
          type: 'increase',
          message: `Add ${increment} kg → ${suggestedWeight} kg next session (target reps hit with RIR ≥ 1 for 2 sessions).`,
          exerciseId,
          exerciseName: latest.exerciseName,
          suggestedWeightKg: suggestedWeight,
        })
      } else {
        suggestions.push({
          type: 'increase',
          message: 'Increase weight next session — target reps hit with RIR ≥ 1 for 2 sessions.',
          exerciseId,
          exerciseName: latest.exerciseName,
        })
      }
      continue
    }

    // Maintain: hit target but near failure (average RIR < 1)
    if (
      latestEval.hitTarget &&
      latestEval.avgRir !== null &&
      latestEval.avgRir < 1
    ) {
      suggestions.push({
        type: 'maintain',
        message: 'Maintain weight — near failure (avg RIR < 1). Focus on improving RIR over time.',
        exerciseId,
        exerciseName: latest.exerciseName,
      })
      continue
    }

    // Decrease: below target reps for 2 consecutive sessions
    if (!latestEval.hitTarget && !prevEval.hitTarget) {
      const currentWeight = latestEval.maxWeight
      if (currentWeight && currentWeight > 0) {
        const reduction = roundToPlate(currentWeight * 0.05) // 5% reduction
        const suggestedWeight = roundToPlate(currentWeight - Math.max(reduction, 1.25))
        suggestions.push({
          type: 'decrease',
          message: `Reduce to ${suggestedWeight} kg (−${Math.max(reduction, 1.25)} kg) — below target reps for 2 sessions.`,
          exerciseId,
          exerciseName: latest.exerciseName,
          suggestedWeightKg: suggestedWeight,
        })
      } else {
        suggestions.push({
          type: 'decrease',
          message: 'Reduce weight or drop 1 set — below target reps for 2 sessions.',
          exerciseId,
          exerciseName: latest.exerciseName,
        })
      }
    }
  }

  return suggestions
}

export function suggestionColor(type: SuggestionType): string {
  switch (type) {
    case 'increase':
      return 'border-emerald-500/50 bg-emerald-500/10'
    case 'maintain':
      return 'border-amber-500/50 bg-amber-500/10'
    case 'decrease':
      return 'border-orange-500/50 bg-orange-500/10'
    case 'deload':
      return 'border-blue-500/50 bg-blue-500/10'
  }
}
