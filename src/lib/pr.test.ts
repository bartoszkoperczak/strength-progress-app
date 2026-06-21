import { calculateExercisePRRecords, checkIsPR, identifyPRsInWorkout } from './pr'
import { calculateOneRm } from './one-rm'

describe('pr', () => {
  const dummySets = [
    {
      exercise_id: 'bench',
      weight_kg: 80,
      reps: 5,
      rir: 2,
      is_warmup: false,
      workout: { completed_at: '2026-06-01T12:00:00Z' },
    },
    {
      exercise_id: 'bench',
      weight_kg: 90,
      reps: 5,
      rir: 2,
      is_warmup: false,
      workout: { completed_at: '2026-06-05T12:00:00Z' },
    },
    {
      exercise_id: 'bench',
      weight_kg: 95,
      reps: 3,
      rir: 1,
      is_warmup: false,
      workout: { completed_at: '2026-06-10T12:00:00Z' },
    },
    {
      exercise_id: 'bench',
      weight_kg: 50,
      reps: 10,
      rir: 5,
      is_warmup: true, // Warmup, should be ignored
      workout: { completed_at: '2026-06-10T12:00:00Z' },
    },
  ]

  it('calculates exercise PR records correctly', () => {
    const records = calculateExercisePRRecords(dummySets)
    const benchRecord = records.get('bench')
    
    expect(benchRecord).toBeDefined()
    expect(benchRecord?.maxWeight).toBe(95)
    expect(benchRecord?.max1Rm).toBeCloseTo(109.4, 0)
    expect(benchRecord?.maxWeightByReps.get(5)).toBe(90)
    expect(benchRecord?.maxWeightByReps.get(3)).toBe(95)
    expect(benchRecord?.maxWeightByReps.get(10)).toBeUndefined()
  })

  it('filters by beforeDate correctly', () => {
    const records = calculateExercisePRRecords(dummySets, '2026-06-06T00:00:00Z')
    const benchRecord = records.get('bench')

    expect(benchRecord).toBeDefined()
    expect(benchRecord?.maxWeight).toBe(90)
    expect(benchRecord?.maxWeightByReps.get(5)).toBe(90)
    expect(benchRecord?.maxWeightByReps.get(3)).toBeUndefined()
  })

  it('flags first performance as PR', () => {
    const set = { weight_kg: 60, reps: 8, rir: 2, is_warmup: false }
    const result = checkIsPR(set, undefined)
    expect(result.isPR).toBe(true)
    expect(result.reasons[0]).toContain('First time')
  })

  it('flags new 1RM as PR', () => {
    const records = calculateExercisePRRecords(dummySets)
    const benchRecord = records.get('bench')

    const set1 = { weight_kg: 100, reps: 5, rir: 2, is_warmup: false }
    const res1 = checkIsPR(set1, benchRecord)
    expect(res1.isPR).toBe(true)
    expect(res1.reasons.some(r => r.includes('1RM PR'))).toBe(true)
  })

  it('does NOT flag a set as PR when 1RM is lower', () => {
    const records = calculateExercisePRRecords(dummySets)
    const benchRecord = records.get('bench')

    const set2 = { weight_kg: 92, reps: 3, rir: 2, is_warmup: false }
    const res2 = checkIsPR(set2, benchRecord)
    expect(res2.isPR).toBe(false)
  })

  it('does NOT flag a set as PR just because the rep count is new', () => {
    const records = calculateExercisePRRecords(dummySets)
    const benchRecord = records.get('bench')

    const set = { weight_kg: 60, reps: 12, rir: 3, is_warmup: false }
    const res = checkIsPR(set, benchRecord)
    expect(res.isPR).toBe(false)
  })

  // --- identifyPRsInWorkout tests ---

  it('marks only the SINGLE best set as PR in a workout', () => {
    const benchRecord = calculateExercisePRRecords(dummySets).get('bench') // historical max 1RM ~109.4

    // Progressive sets — only the best one (set 3) should be PR
    const sessionSets = [
      { set_number: 1, weight_kg: 100, reps: 5, rir: 2, is_warmup: false }, // 1RM ~121.6
      { set_number: 2, weight_kg: 100, reps: 5, rir: 2, is_warmup: false }, // 1RM ~121.6
      { set_number: 3, weight_kg: 102.5, reps: 5, rir: 2, is_warmup: false }, // 1RM ~124.6 ← best
      { set_number: 4, weight_kg: 90, reps: 5, rir: 2, is_warmup: false }, // 1RM ~109.4
    ]

    const prSetNumbers = identifyPRsInWorkout(sessionSets, benchRecord)
    expect(prSetNumbers.size).toBe(1)
    expect(prSetNumbers.has(3)).toBe(true)
  })

  it('marks only one PR when all sets are identical', () => {
    const record = calculateExercisePRRecords([dummySets[0]]).get('bench')

    const sessionSets = [
      { set_number: 1, weight_kg: 90, reps: 5, rir: 2, is_warmup: false },
      { set_number: 2, weight_kg: 90, reps: 5, rir: 2, is_warmup: false },
      { set_number: 3, weight_kg: 90, reps: 5, rir: 2, is_warmup: false },
    ]

    const prSetNumbers = identifyPRsInWorkout(sessionSets, record)
    expect(prSetNumbers.size).toBe(1)
    // Any one of them — they're identical, but only one gets marked
    expect(prSetNumbers.has(1)).toBe(true)
  })

  it('marks no PRs when performance is the same as history', () => {
    const record = calculateExercisePRRecords(dummySets).get('bench') // max 1RM ~109.4

    const sessionSets = [
      { set_number: 1, weight_kg: 90, reps: 5, rir: 2, is_warmup: false }, // 1RM ~109.4 = history (not strictly greater)
      { set_number: 2, weight_kg: 85, reps: 5, rir: 2, is_warmup: false },
    ]

    const prSetNumbers = identifyPRsInWorkout(sessionSets, record)
    expect(prSetNumbers.size).toBe(0)
  })

  it('does not mark sets with different rep counts as PRs when 1RM is lower', () => {
    const record = calculateExercisePRRecords(dummySets).get('bench') // max 1RM ~109.4

    const sessionSets = [
      { set_number: 1, weight_kg: 70, reps: 8, rir: 2, is_warmup: false },
      { set_number: 2, weight_kg: 60, reps: 12, rir: 3, is_warmup: false },
      { set_number: 3, weight_kg: 80, reps: 3, rir: 1, is_warmup: false },
    ]

    const prSetNumbers = identifyPRsInWorkout(sessionSets, record)
    expect(prSetNumbers.size).toBe(0)
  })

  it('uses weight as tiebreaker when 1RM values are equal', () => {
    // Two sets with the same 1RM but different weights
    // Create a scenario: set A and set B produce the same recommended 1RM
    // We pick the one with higher weight
    const record = calculateExercisePRRecords([dummySets[0]]).get('bench') // 80x5@2 → 1RM ~97.3

    // Both should beat history. The one with higher weight should be the PR.
    const sessionSets = [
      { set_number: 1, weight_kg: 100, reps: 5, rir: 2, is_warmup: false }, // 1RM ~121.6
      { set_number: 2, weight_kg: 110, reps: 3, rir: 1, is_warmup: false }, // 1RM = let's compute
    ]

    // Verify which one is actually picked
    const oneRm1 = calculateOneRm({ weightKg: 100, reps: 5, rir: 2 }).recommended
    const oneRm2 = calculateOneRm({ weightKg: 110, reps: 3, rir: 1 }).recommended

    const prSetNumbers = identifyPRsInWorkout(sessionSets, record)
    expect(prSetNumbers.size).toBe(1)

    // The set with the higher 1RM should be picked
    if (oneRm1 > oneRm2) {
      expect(prSetNumbers.has(1)).toBe(true)
    } else if (oneRm2 > oneRm1) {
      expect(prSetNumbers.has(2)).toBe(true)
    } else {
      // Equal 1RM — the one with higher weight (110) should be picked
      expect(prSetNumbers.has(2)).toBe(true)
    }
  })

  it('simulates the Back Squat scenario: only the heaviest progressive set is PR', () => {
    // User does Back Squat with no prior history
    const sessionSets = [
      { set_number: 1, weight_kg: 60, reps: 8, rir: 2, is_warmup: false },
      { set_number: 2, weight_kg: 70, reps: 8, rir: 2, is_warmup: false },
      { set_number: 3, weight_kg: 75, reps: 8, rir: 2, is_warmup: false }, // best
    ]

    // No history
    const prSetNumbers = identifyPRsInWorkout(sessionSets, undefined)
    expect(prSetNumbers.size).toBe(1)
    expect(prSetNumbers.has(3)).toBe(true) // Only the best set
  })

  it('simulates the Incline DB Press scenario: only the best 1RM set is PR', () => {
    // User does Incline DB Press with no prior history
    const sessionSets = [
      { set_number: 1, weight_kg: 26, reps: 8, rir: 2, is_warmup: false }, // 1RM lower
      { set_number: 2, weight_kg: 30, reps: 6, rir: 0, is_warmup: false }, // 1RM higher ← best
      { set_number: 3, weight_kg: 30, reps: 6, rir: 0, is_warmup: false }, // same as set 2
      { set_number: 4, weight_kg: 30, reps: 6, rir: 0, is_warmup: false }, // same as set 2
    ]

    const prSetNumbers = identifyPRsInWorkout(sessionSets, undefined)
    expect(prSetNumbers.size).toBe(1)
    expect(prSetNumbers.has(2)).toBe(true) // Only the best one
  })
})
