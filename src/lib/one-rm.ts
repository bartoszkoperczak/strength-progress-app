export interface OneRmInput {
  weightKg: number
  reps: number
  rir?: number
}

export interface OneRmResult {
  epley: number
  brzycki: number
  lombardi: number
  recommended: number
  effectiveReps: number
}

export function effectiveReps(reps: number, rir = 0): number {
  return reps + rir
}

export function epley1Rm(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function brzycki1Rm(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg
  if (reps === 1) return weightKg
  if (reps >= 37) return weightKg
  return weightKg * (36 / (37 - reps))
}

export function lombardi1Rm(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg
  if (reps === 1) return weightKg
  return weightKg * Math.pow(reps, 0.1)
}

export function calculateOneRm({ weightKg, reps, rir = 0 }: OneRmInput): OneRmResult {
  const eff = effectiveReps(reps, rir)
  const epley = epley1Rm(weightKg, eff)
  const brzycki = brzycki1Rm(weightKg, eff)
  const lombardi = lombardi1Rm(weightKg, eff)
  const recommended = (epley + brzycki + lombardi) / 3

  return {
    epley: round1(epley),
    brzycki: round1(brzycki),
    lombardi: round1(lombardi),
    recommended: round1(recommended),
    effectiveReps: eff,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function bestSetOneRm(
  sets: Array<{ weight_kg: number; reps: number; rir: number; is_warmup: boolean }>,
): OneRmResult | null {
  const working = sets.filter((s) => !s.is_warmup && s.reps > 0 && s.weight_kg > 0)
  if (working.length === 0) return null

  let best: OneRmResult | null = null
  for (const set of working) {
    const result = calculateOneRm({
      weightKg: Number(set.weight_kg),
      reps: set.reps,
      rir: set.rir,
    })
    if (!best || result.recommended > best.recommended) {
      best = result
    }
  }
  return best
}
