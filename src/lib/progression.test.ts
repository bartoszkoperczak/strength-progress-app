import { describe, expect, it } from 'vitest'
import { evaluateSession, getProgressionSuggestions } from '@/lib/progression'

describe('progression', () => {
  it('detects target hit with RIR', () => {
    const result = evaluateSession(
      [
        { reps: 8, rir: 2, is_warmup: false },
        { reps: 8, rir: 3, is_warmup: false },
      ],
      8,
    )
    expect(result.hitTarget).toBe(true)
    expect(result.lastRir).toBe(3)
  })

  it('suggests weight increase after 2 good sessions', () => {
    const sessions = [
      {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        targetReps: 8,
        completedAt: '2026-06-10',
        sets: [
          { reps: 8, rir: 2, is_warmup: false },
          { reps: 8, rir: 2, is_warmup: false },
        ],
      },
      {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        targetReps: 8,
        completedAt: '2026-06-07',
        sets: [
          { reps: 8, rir: 3, is_warmup: false },
          { reps: 8, rir: 2, is_warmup: false },
        ],
      },
    ]
    const suggestions = getProgressionSuggestions(sessions, 3)
    expect(suggestions.some((s) => s.type === 'increase')).toBe(true)
  })

  it('suggests deload after 14+ days', () => {
    const suggestions = getProgressionSuggestions([], 15)
    expect(suggestions.some((s) => s.type === 'deload')).toBe(true)
  })

  it('suggests decrease when below target 2 sessions', () => {
    const sessions = [
      {
        exerciseId: 'ex1',
        exerciseName: 'Squat',
        targetReps: 8,
        completedAt: '2026-06-10',
        sets: [{ reps: 5, rir: 1, is_warmup: false }],
      },
      {
        exerciseId: 'ex1',
        exerciseName: 'Squat',
        targetReps: 8,
        completedAt: '2026-06-07',
        sets: [{ reps: 6, rir: 1, is_warmup: false }],
      },
    ]
    const suggestions = getProgressionSuggestions(sessions, 3)
    expect(suggestions.some((s) => s.type === 'decrease')).toBe(true)
  })
})
