import { describe, expect, it } from 'vitest'
import { evaluateSession, getProgressionSuggestions, calculateIncrement } from '@/lib/progression'

describe('progression', () => {
  it('detects target hit with average RIR', () => {
    const result = evaluateSession(
      [
        { reps: 8, rir: 1, is_warmup: false, weight_kg: 60 },
        { reps: 8, rir: 2, is_warmup: false, weight_kg: 60 },
      ],
      8,
    )
    expect(result.hitTarget).toBe(true)
    expect(result.avgRir).toBe(1.5)
    expect(result.maxWeight).toBe(60)
  })

  it('computes average RIR across all working sets', () => {
    const result = evaluateSession(
      [
        { reps: 8, rir: 0, is_warmup: false, weight_kg: 80 },
        { reps: 8, rir: 0, is_warmup: false, weight_kg: 80 },
        { reps: 8, rir: 1, is_warmup: false, weight_kg: 80 },
      ],
      8,
    )
    expect(result.hitTarget).toBe(true)
    expect(result.avgRir).toBeCloseTo(0.333, 2)
  })

  it('excludes warmup sets from evaluation', () => {
    const result = evaluateSession(
      [
        { reps: 10, rir: 3, is_warmup: true, weight_kg: 40 },
        { reps: 8, rir: 0, is_warmup: false, weight_kg: 60 },
      ],
      8,
    )
    expect(result.hitTarget).toBe(true)
    expect(result.avgRir).toBe(0)
    expect(result.maxWeight).toBe(60)
  })

  it('tracks max weight from working sets only', () => {
    const result = evaluateSession(
      [
        { reps: 10, rir: 3, is_warmup: true, weight_kg: 40 },
        { reps: 8, rir: 1, is_warmup: false, weight_kg: 60 },
        { reps: 8, rir: 1, is_warmup: false, weight_kg: 65 },
      ],
      8,
    )
    expect(result.maxWeight).toBe(65)
  })
})

describe('calculateIncrement', () => {
  it('returns 0.5 kg for light weights (< 25 kg)', () => {
    expect(calculateIncrement(10)).toBe(0.5)
    expect(calculateIncrement(20)).toBe(0.5)
  })

  it('returns ~2% for medium weights, rounded to 0.25', () => {
    // 60 kg * 0.02 = 1.2 → rounded to 1.25
    expect(calculateIncrement(60)).toBe(1.25)
    // 80 kg * 0.02 = 1.6 → rounded to 1.5
    expect(calculateIncrement(80)).toBe(1.5)
  })

  it('caps at 2.5 kg for heavy weights', () => {
    // 150 kg * 0.02 = 3.0 → capped at 2.5
    expect(calculateIncrement(150)).toBe(2.5)
    expect(calculateIncrement(200)).toBe(2.5)
  })

  it('returns 1.25 for zero weight', () => {
    expect(calculateIncrement(0)).toBe(1.25)
  })
})

describe('getProgressionSuggestions', () => {
  it('suggests weight increase with concrete weight', () => {
    const sessions = [
      {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        targetReps: 8,
        completedAt: '2026-06-10',
        sets: [
          { reps: 8, rir: 1, is_warmup: false, weight_kg: 60 },
          { reps: 8, rir: 1, is_warmup: false, weight_kg: 60 },
        ],
      },
      {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        targetReps: 8,
        completedAt: '2026-06-07',
        sets: [
          { reps: 8, rir: 2, is_warmup: false, weight_kg: 60 },
          { reps: 8, rir: 1, is_warmup: false, weight_kg: 60 },
        ],
      },
    ]
    const suggestions = getProgressionSuggestions(sessions, 3)
    const increase = suggestions.find((s) => s.type === 'increase')
    expect(increase).toBeDefined()
    expect(increase!.suggestedWeightKg).toBe(61.25) // 60 + 1.25
    expect(increase!.message).toContain('61.25')
  })

  it('suggests small increment for light exercises', () => {
    const sessions = [
      {
        exerciseId: 'ex1',
        exerciseName: 'Lateral Raise',
        targetReps: 12,
        completedAt: '2026-06-10',
        sets: [
          { reps: 12, rir: 2, is_warmup: false, weight_kg: 8 },
          { reps: 12, rir: 1, is_warmup: false, weight_kg: 8 },
        ],
      },
      {
        exerciseId: 'ex1',
        exerciseName: 'Lateral Raise',
        targetReps: 12,
        completedAt: '2026-06-07',
        sets: [
          { reps: 12, rir: 2, is_warmup: false, weight_kg: 8 },
          { reps: 12, rir: 1, is_warmup: false, weight_kg: 8 },
        ],
      },
    ]
    const suggestions = getProgressionSuggestions(sessions, 3)
    const increase = suggestions.find((s) => s.type === 'increase')
    expect(increase).toBeDefined()
    expect(increase!.suggestedWeightKg).toBe(8.5) // 8 + 0.5
  })

  it('does NOT suggest increase when avg RIR < 1 (near failure)', () => {
    const sessions = [
      {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        targetReps: 8,
        completedAt: '2026-06-10',
        sets: [
          { reps: 8, rir: 0, is_warmup: false, weight_kg: 80 },
          { reps: 8, rir: 0, is_warmup: false, weight_kg: 80 },
        ],
      },
      {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        targetReps: 8,
        completedAt: '2026-06-07',
        sets: [
          { reps: 8, rir: 0, is_warmup: false, weight_kg: 80 },
          { reps: 8, rir: 0, is_warmup: false, weight_kg: 80 },
        ],
      },
    ]
    const suggestions = getProgressionSuggestions(sessions, 3)
    expect(suggestions.some((s) => s.type === 'increase')).toBe(false)
    expect(suggestions.some((s) => s.type === 'maintain')).toBe(true)
  })

  it('suggests deload after 14+ days', () => {
    const suggestions = getProgressionSuggestions([], 15)
    expect(suggestions.some((s) => s.type === 'deload')).toBe(true)
  })

  it('suggests decrease with concrete weight', () => {
    const sessions = [
      {
        exerciseId: 'ex1',
        exerciseName: 'Squat',
        targetReps: 8,
        completedAt: '2026-06-10',
        sets: [{ reps: 5, rir: 0, is_warmup: false, weight_kg: 100 }],
      },
      {
        exerciseId: 'ex1',
        exerciseName: 'Squat',
        targetReps: 8,
        completedAt: '2026-06-07',
        sets: [{ reps: 6, rir: 0, is_warmup: false, weight_kg: 100 }],
      },
    ]
    const suggestions = getProgressionSuggestions(sessions, 3)
    const decrease = suggestions.find((s) => s.type === 'decrease')
    expect(decrease).toBeDefined()
    expect(decrease!.suggestedWeightKg).toBe(95) // 100 - 5 (5% of 100)
    expect(decrease!.message).toContain('95')
  })

  it('suggests maintain when hitting target but avg RIR is 0', () => {
    const sessions = [
      {
        exerciseId: 'ex1',
        exerciseName: 'Deadlift',
        targetReps: 5,
        completedAt: '2026-06-10',
        sets: [
          { reps: 5, rir: 0, is_warmup: false, weight_kg: 140 },
          { reps: 5, rir: 0, is_warmup: false, weight_kg: 140 },
        ],
      },
      {
        exerciseId: 'ex1',
        exerciseName: 'Deadlift',
        targetReps: 5,
        completedAt: '2026-06-07',
        sets: [
          { reps: 5, rir: 1, is_warmup: false, weight_kg: 140 },
          { reps: 5, rir: 1, is_warmup: false, weight_kg: 140 },
        ],
      },
    ]
    const suggestions = getProgressionSuggestions(sessions, 3)
    expect(suggestions.some((s) => s.type === 'maintain')).toBe(true)
  })
})
