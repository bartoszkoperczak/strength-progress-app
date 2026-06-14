export type SuggestionType = 'increase' | 'maintain' | 'decrease' | 'deload'

export interface ProgressionSuggestion {
  type: SuggestionType
  message: string
  exerciseId: string
  exerciseName: string
}

export interface SessionSet {
  reps: number
  rir: number
  is_warmup: boolean
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
): { hitTarget: boolean; lastRir: number | null } {
  const working = sets.filter((s) => !s.is_warmup)
  if (working.length === 0) return { hitTarget: false, lastRir: null }

  const hitTarget = working.every((s) => s.reps >= targetReps)
  const lastRir = working[working.length - 1]?.rir ?? null
  return { hitTarget, lastRir }
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

    if (
      latestEval.hitTarget &&
      prevEval.hitTarget &&
      latestEval.lastRir !== null &&
      prevEval.lastRir !== null &&
      latestEval.lastRir >= 2 &&
      prevEval.lastRir >= 2
    ) {
      suggestions.push({
        type: 'increase',
        message: 'Add 2.5 kg next session — target reps hit with RIR ≥ 2 for 2 sessions.',
        exerciseId,
        exerciseName: latest.exerciseName,
      })
      continue
    }

    if (
      latestEval.lastRir === 0 &&
      prevEval.lastRir === 0
    ) {
      suggestions.push({
        type: 'maintain',
        message: 'Maintain weight — near failure (RIR 0) for 2 sessions.',
        exerciseId,
        exerciseName: latest.exerciseName,
      })
      continue
    }

    if (!latestEval.hitTarget && !prevEval.hitTarget) {
      suggestions.push({
        type: 'decrease',
        message: 'Reduce 2.5 kg or drop 1 set — below target reps for 2 sessions.',
        exerciseId,
        exerciseName: latest.exerciseName,
      })
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
