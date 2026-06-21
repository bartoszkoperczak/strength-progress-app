import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Check, Copy, Plus, ArrowLeft, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import {
  useWorkout,
  useCompleteWorkout,
  useUpsertWorkoutSet,
  useDeleteWorkoutSet,
  useBatchUpsertWorkoutSets,
  useLastPerformance,
  useExercisePRs,
} from '@/features/workouts/api'
import { checkIsPR, identifyPRsInWorkout, type ExercisePRRecord } from '@/lib/pr'

import { Button } from '@/components/ui/button'
import { NumericInput } from '@/components/ui/NumericInput'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { roundWeight } from '@/lib/utils'
import type { WorkoutSet } from '@/types/database'

interface SetDraft {
  id?: string
  set_number: number
  weight_kg: number
  reps: number
  rir: number
  is_warmup: boolean
  /** True if this draft has unsaved changes */
  dirty: boolean
}

function LastTimeBanner({ exerciseId }: { exerciseId: string }) {
  const { data } = useLastPerformance(exerciseId)
  if (!data) return null
  return (
    <div className="rounded-lg bg-slate-800/80 px-3 py-2 text-sm text-slate-300">
      Last time: <span className="font-semibold text-emerald-400">{data.weight_kg} kg</span>
      {' × '}{data.reps} reps @ RIR {data.rir}
    </div>
  )
}

/**
 * Register a callback to collect unsaved drafts from this exercise block.
 * This lets the parent "Finish" button batch-save everything.
 */
type DraftCollector = () => SetDraft[]

function ExerciseBlock({
  exerciseId,
  exerciseName,
  targetSets,
  targetReps,
  workoutId,
  existingSets,
  registerCollector,
  historicalRecord,
}: {
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps: number
  workoutId: string
  existingSets: WorkoutSet[]
  registerCollector: (exerciseId: string, collector: DraftCollector) => void
  historicalRecord: ExercisePRRecord | undefined
}) {
  const upsert = useUpsertWorkoutSet(/* skipInvalidation */ true)
  const remove = useDeleteWorkoutSet()
  const { data: lastPerf } = useLastPerformance(exerciseId)

  const exerciseSets = useMemo(
    () => existingSets.filter((s) => s.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number),
    [existingSets, exerciseId],
  )

  const [drafts, setDrafts] = useState<SetDraft[]>([])
  const initializedRef = useRef(false)
  
  // Track the weight/reps/rir we've already toasted for each set_number
  const toastedValuesRef = useRef<Map<number, string>>(new Map())

  // Dynamically calculate which set numbers are PRs in this session
  const prSetNumbers = useMemo(() => {
    return identifyPRsInWorkout(drafts, historicalRecord)
  }, [drafts, historicalRecord])

  // Initialize drafts ONCE from server data (or template defaults)
  useEffect(() => {
    if (initializedRef.current) {
      setDrafts((prev) => {
        const prevIds = new Set(prev.map((d) => d.id).filter(Boolean))
        const newServerSets = exerciseSets.filter((s) => !prevIds.has(s.id))
        if (newServerSets.length === 0) return prev

        const prevSetNumbers = new Set(prev.map((d) => d.set_number))
        const toAdd = newServerSets
          .filter((s) => !prevSetNumbers.has(s.set_number))
          .map((s) => ({
            id: s.id,
            set_number: s.set_number,
            weight_kg: Number(s.weight_kg),
            reps: s.reps,
            rir: s.rir,
            is_warmup: s.is_warmup,
            dirty: false,
          }))

        if (toAdd.length === 0) return prev
        return [...prev, ...toAdd].sort((a, b) => a.set_number - b.set_number)
      })
      return
    }

    if (exerciseSets.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts(
        exerciseSets.map((s) => ({
          id: s.id,
          set_number: s.set_number,
          weight_kg: Number(s.weight_kg),
          reps: s.reps,
          rir: s.rir,
          is_warmup: s.is_warmup,
          dirty: false,
        })),
      )
      initializedRef.current = true
    } else if (lastPerf !== undefined) {
      setDrafts(
        Array.from({ length: targetSets }, (_, i) => ({
          set_number: i + 1,
          weight_kg: lastPerf ? Number(lastPerf.weight_kg) : 0,
          reps: targetReps,
          rir: 2,
          is_warmup: false,
          dirty: false,
        })),
      )
      initializedRef.current = true
    }
  }, [exerciseSets, targetSets, targetReps, lastPerf])

  // Register collector so parent can batch-save on Finish
  useEffect(() => {
    registerCollector(exerciseId, () => drafts.filter((d) => d.dirty || !d.id))
  }, [exerciseId, registerCollector, drafts])

  // Debounced auto-save: save dirty drafts 800ms after last edit
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)

  const saveSet = useCallback(
    async (draft: SetDraft, index: number) => {
      if (savingRef.current) return
      savingRef.current = true
      try {
        const result = await upsert.mutateAsync({
          id: draft.id,
          workout_id: workoutId,
          exercise_id: exerciseId,
          set_number: draft.set_number,
          weight_kg: draft.weight_kg,
          reps: draft.reps,
          rir: draft.rir,
          is_warmup: draft.is_warmup,
        })

        // Patch the returned ID into the local draft
        setDrafts((prev) => {
          const next = [...prev]
          if (next[index]) {
            next[index] = { ...next[index], id: result.id, dirty: false }
          }
          return next
        })

        const isPR = prSetNumbers.has(draft.set_number)
        const valStr = `${draft.weight_kg}-${draft.reps}-${draft.rir}`

        // Show PR toast (only once per unique set configuration)
        if (isPR && toastedValuesRef.current.get(draft.set_number) !== valStr) {
          toastedValuesRef.current.set(draft.set_number, valStr)

          const checkResult = checkIsPR(
            { weight_kg: draft.weight_kg, reps: draft.reps, rir: draft.rir, is_warmup: draft.is_warmup },
            historicalRecord
          )
          
          const reasonText = checkResult.reasons.join(', ')
          toast.success(
            `🏆 New PR! ${exerciseName} — ${draft.weight_kg} kg × ${draft.reps} (${reasonText})`,
            { duration: 5000 }
          )
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save set')
      } finally {
        savingRef.current = false
      }
    },
    [upsert, workoutId, exerciseId, exerciseName, prSetNumbers, drafts, historicalRecord],
  )

  const scheduleSave = useCallback(
    (index: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        setDrafts((current) => {
          const draft = current[index]
          if (draft?.dirty) {
            saveSet(draft, index)
          }
          return current
        })
      }, 800)
    },
    [saveSet],
  )

  const updateDraft = (index: number, patch: Partial<SetDraft>) => {
    setDrafts((prev) => {
      const next = [...prev]
      const updated = { ...next[index], ...patch, dirty: true }
      next[index] = updated
      return next
    })
    scheduleSave(index)
  }

  const handleBlurSave = (index: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const draft = drafts[index]
    if (draft?.dirty) {
      saveSet(draft, index)
    }
  }

  const addSet = () => {
    const last = drafts[drafts.length - 1]
    setDrafts([
      ...drafts,
      {
        set_number: drafts.length + 1,
        weight_kg: last?.weight_kg ?? 0,
        reps: last?.reps ?? targetReps,
        rir: last?.rir ?? 2,
        is_warmup: false,
        dirty: true,
      },
    ])
  }

  const copyLast = (index: number) => {
    if (!lastPerf) return
    updateDraft(index, {
      weight_kg: Number(lastPerf.weight_kg),
      reps: lastPerf.reps,
      rir: lastPerf.rir,
    })
  }

  const addWeight = (index: number) => {
    const newWeight = roundWeight((drafts[index]?.weight_kg ?? 0) + 2.5)
    updateDraft(index, { weight_kg: newWeight })
  }

  const hasPR = prSetNumbers.size > 0

  return (
    <Card className={hasPR ? 'border-amber-500/30' : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>{exerciseName}</CardTitle>
            {hasPR && (
              <Badge variant="pr">
                <Trophy className="mr-1 h-3 w-3" />PR
              </Badge>
            )}
          </div>
          <Badge variant="outline">{targetSets}×{targetReps}</Badge>
        </div>
        <LastTimeBanner exerciseId={exerciseId} />
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.map((draft, index) => {
          const isPR = prSetNumbers.has(draft.set_number)
          return (
            <div
              key={draft.set_number}
              className={`rounded-lg border p-3 space-y-3 ${
                isPR
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-400">Set {draft.set_number}</span>
                  {isPR && (
                    <Badge variant="pr" className="text-[10px] px-1.5 py-0">
                      <Trophy className="mr-0.5 h-2.5 w-2.5" />PR
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {draft.dirty && (
                    <span className="h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" />
                  )}
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <Checkbox
                      checked={draft.is_warmup}
                      onChange={(e) => updateDraft(index, { is_warmup: e.target.checked })}
                    />
                    Warmup
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">kg</Label>
                  <NumericInput
                    value={draft.weight_kg}
                    onValueChange={(v) => updateDraft(index, { weight_kg: v })}
                    onBlur={() => handleBlurSave(index)}
                    min={0}
                    step={0.25}
                    allowDecimal
                  />
                </div>
                <div>
                  <Label className="text-xs">Reps</Label>
                  <NumericInput
                    value={draft.reps}
                    onValueChange={(v) => updateDraft(index, { reps: v })}
                    onBlur={() => handleBlurSave(index)}
                    min={0}
                    max={999}
                  />
                </div>
                <div>
                  <Label className="text-xs">RIR</Label>
                  <NumericInput
                    value={draft.rir}
                    onValueChange={(v) => updateDraft(index, { rir: v })}
                    onBlur={() => handleBlurSave(index)}
                    min={0}
                    max={10}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyLast(index)} disabled={!lastPerf}>
                  <Copy className="h-3 w-3" /> Copy last
                </Button>
                <Button size="sm" variant="outline" onClick={() => addWeight(index)}>
                  +2.5 kg
                </Button>
                {draft.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await remove.mutateAsync({ id: draft.id!, workoutId })
                      setDrafts((d) => d.filter((_, i) => i !== index).map((s, i) => ({ ...s, set_number: i + 1 })))
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        <Button variant="outline" size="sm" onClick={addSet}>
          <Plus className="h-4 w-4" /> Add set
        </Button>
      </CardContent>
    </Card>
  )
}

export function ActiveWorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: workout, isLoading } = useWorkout(id)
  const completeWorkout = useCompleteWorkout()
  const batchUpsert = useBatchUpsertWorkoutSets()
  const { data: exercisePRs } = useExercisePRs()

  const templateExercises = useMemo(() => {
    const tes = workout?.template?.template_exercises ?? []
    return [...tes].sort((a, b) => a.sort_order - b.sort_order)
  }, [workout])

  // Collect unsaved drafts from all exercise blocks
  const collectorsRef = useRef<Map<string, DraftCollector>>(new Map())
  const registerCollector = useCallback((exerciseId: string, collector: DraftCollector) => {
    collectorsRef.current.set(exerciseId, collector)
  }, [])

  const handleComplete = async () => {
    if (!id) return
    try {
      const allUnsaved: Array<{
        workout_id: string
        exercise_id: string
        set_number: number
        weight_kg: number
        reps: number
        rir: number
        is_warmup: boolean
        id?: string
      }> = []
      for (const [exerciseId, collector] of collectorsRef.current.entries()) {
        const unsaved = collector()
        for (const draft of unsaved) {
          allUnsaved.push({
            id: draft.id,
            workout_id: id,
            exercise_id: exerciseId,
            set_number: draft.set_number,
            weight_kg: draft.weight_kg,
            reps: draft.reps,
            rir: draft.rir,
            is_warmup: draft.is_warmup,
          })
        }
      }

      if (allUnsaved.length > 0) {
        await batchUpsert.mutateAsync(allUnsaved)
      }

      await completeWorkout.mutateAsync(id)
      toast.success('Workout completed!')
      navigate('/history')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete')
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!workout) return <p>Workout not found</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/workout" className="text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{workout.template?.name ?? 'Workout'}</h1>
            <p className="text-sm text-slate-400">In progress</p>
          </div>
        </div>
        <Button onClick={handleComplete} disabled={completeWorkout.isPending || batchUpsert.isPending}>
          <Check className="h-4 w-4" /> Finish
        </Button>
      </div>

      <div className="space-y-4">
        {templateExercises.map((te) => (
          <ExerciseBlock
            key={te.exercise_id}
            exerciseId={te.exercise_id}
            exerciseName={te.exercise?.name ?? 'Exercise'}
            targetSets={te.target_sets}
            targetReps={te.target_reps}
            workoutId={workout.id}
            existingSets={workout.workout_sets ?? []}
            registerCollector={registerCollector}
            historicalRecord={exercisePRs?.get(te.exercise_id)}
          />
        ))}
      </div>
    </div>
  )
}
