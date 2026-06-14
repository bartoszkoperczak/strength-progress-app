import { describe, expect, it } from 'vitest'
import { calculateOneRm, epley1Rm, brzycki1Rm, lombardi1Rm, effectiveReps } from '@/lib/one-rm'

describe('one-rm', () => {
  it('calculates effective reps with RIR', () => {
    expect(effectiveReps(5, 2)).toBe(7)
  })

  it('calculates Epley formula', () => {
    expect(epley1Rm(100, 5)).toBeCloseTo(116.67, 1)
  })

  it('calculates Brzycki formula', () => {
    expect(brzycki1Rm(100, 5)).toBeCloseTo(112.5, 1)
  })

  it('calculates Lombardi formula', () => {
    expect(lombardi1Rm(100, 5)).toBeGreaterThan(100)
  })

  it('returns recommended average', () => {
    const result = calculateOneRm({ weightKg: 100, reps: 5 })
    expect(result.recommended).toBeGreaterThan(100)
    expect(result.epley).toBeGreaterThan(0)
    expect(result.brzycki).toBeGreaterThan(0)
    expect(result.lombardi).toBeGreaterThan(0)
  })

  it('handles 1 rep as weight', () => {
    const result = calculateOneRm({ weightKg: 140, reps: 1 })
    expect(result.recommended).toBe(140)
  })
})
