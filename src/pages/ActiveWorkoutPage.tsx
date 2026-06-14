import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Check, Copy, Plus, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  useWorkout,
  useCompleteWorkout,
  useUpsertWorkoutSet,
  useDeleteWorkoutSet,
  useLastPerformance,
} from '@/features/workouts/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

function ExerciseBlock({
  exerciseId,
  exerciseName,
  targetSets,
  targetReps,
  workoutId,
  existingSets,
}: {
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps: number
  workoutId: string
  existingSets: WorkoutSet[]
}) {
  const upsert = useUpsertWorkoutSet()
  const remove = useDeleteWorkoutSet()
  const { data: lastPerf } = useLastPerformance(exerciseId)

  const exerciseSets = useMemo(
    () => existingSets.filter((s) => s.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number),
    [existingSets, exerciseId],
  )

  const [drafts, setDrafts] = useState<SetDraft[]>([])

  useEffect(() => {
    if (exerciseSets.length > 0) {
      setDrafts(
        exerciseSets.map((s) => ({
          id: s.id,
          set_number: s.set_number,
          weight_kg: Number(s.weight_kg),
          reps: s.reps,
          rir: s.rir,
          is_warmup: s.is_warmup,
        })),
      )
    } else {
      setDrafts(
        Array.from({ length: targetSets }, (_, i) => ({
          set_number: i + 1,
          weight_kg: lastPerf ? Number(lastPerf.weight_kg) : 0,
          reps: targetReps,
          rir: 2,
          is_warmup: false,
        })),
      )
    }
  }, [exerciseSets, targetSets, targetReps, lastPerf])

  const saveSet = useCallback(
    async (draft: SetDraft) => {
      try {
        await upsert.mutateAsync({
          id: draft.id,
          workout_id: workoutId,
          exercise_id: exerciseId,
          set_number: draft.set_number,
          weight_kg: draft.weight_kg,
          reps: draft.reps,
          rir: draft.rir,
          is_warmup: draft.is_warmup,
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save set')
      }
    },
    [upsert, workoutId, exerciseId],
  )

  const updateDraft = (index: number, patch: Partial<SetDraft>) => {
    setDrafts((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
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
    updateDraft(index, { weight_kg: roundWeight((drafts[index]?.weight_kg ?? 0) + 2.5) })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{exerciseName}</CardTitle>
          <Badge variant="outline">{targetSets}×{targetReps}</Badge>
        </div>
        <LastTimeBanner exerciseId={exerciseId} />
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.map((draft, index) => (
          <div key={draft.set_number} className="rounded-lg border border-slate-800 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Set {draft.set_number}</span>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <Checkbox
                  checked={draft.is_warmup}
                  onChange={(e) => updateDraft(index, { is_warmup: e.target.checked })}
                />
                Warmup
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">kg</Label>
                <Input
                  type="number"
                  step="0.25"
                  inputMode="decimal"
                  value={draft.weight_kg || ''}
                  onChange={(e) => updateDraft(index, { weight_kg: Number(e.target.value) })}
                  onBlur={() => saveSet(drafts[index])}
                />
              </div>
              <div>
                <Label className="text-xs">Reps</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={draft.reps || ''}
                  onChange={(e) => updateDraft(index, { reps: Number(e.target.value) })}
                  onBlur={() => saveSet(drafts[index])}
                />
              </div>
              <div>
                <Label className="text-xs">RIR</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  inputMode="numeric"
                  value={draft.rir}
                  onChange={(e) => updateDraft(index, { rir: Number(e.target.value) })}
                  onBlur={() => saveSet(drafts[index])}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyLast(index)} disabled={!lastPerf}>
                <Copy className="h-3 w-3" /> Copy last
              </Button>
              <Button size="sm" variant="outline" onClick={() => { addWeight(index); setTimeout(() => saveSet({ ...drafts[index], weight_kg: roundWeight(draft.weight_kg + 2.5) }), 0) }}>
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
        ))}
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

  const templateExercises = useMemo(() => {
    const tes = workout?.template?.template_exercises ?? []
    return [...tes].sort((a, b) => a.sort_order - b.sort_order)
  }, [workout])

  const handleComplete = async () => {
    if (!id) return
    try {
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
        <Button onClick={handleComplete} disabled={completeWorkout.isPending}>
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
          />
        ))}
      </div>
    </div>
  )
}
