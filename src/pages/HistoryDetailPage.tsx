import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Pencil, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  useWorkout,
  useDeleteWorkout,
  useUpsertWorkoutSet,
  useDeleteWorkoutSet,
} from '@/features/workouts/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatDuration } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { NumericInput } from '@/components/ui/NumericInput'
import { Label } from '@/components/ui/label'
import type { WorkoutSet } from '@/types/database'

interface EditSetDraft {
  id?: string
  exercise_id: string
  set_number: number
  weight_kg: number
  reps: number
  rir: number
  is_warmup: boolean
}

function EditableExerciseBlock({
  exerciseId,
  name,
  sets,
  workoutId,
}: {
  exerciseId: string
  name: string
  sets: WorkoutSet[]
  workoutId: string
}) {
  const upsert = useUpsertWorkoutSet()
  const remove = useDeleteWorkoutSet()
  const [drafts, setDrafts] = useState<EditSetDraft[]>(() =>
    sets.map((s) => ({
      id: s.id,
      exercise_id: s.exercise_id,
      set_number: s.set_number,
      weight_kg: Number(s.weight_kg),
      reps: s.reps,
      rir: s.rir,
      is_warmup: s.is_warmup,
    })),
  )

  const updateDraft = (index: number, patch: Partial<EditSetDraft>) => {
    setDrafts((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const saveDraft = useCallback(
    async (draft: EditSetDraft) => {
      try {
        await upsert.mutateAsync({
          id: draft.id,
          workout_id: workoutId,
          exercise_id: draft.exercise_id,
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
    [upsert, workoutId],
  )

  const addSet = async () => {
    const last = drafts[drafts.length - 1]
    const newDraft: EditSetDraft = {
      exercise_id: exerciseId,
      set_number: drafts.length + 1,
      weight_kg: last?.weight_kg ?? 0,
      reps: last?.reps ?? 0,
      rir: last?.rir ?? 2,
      is_warmup: false,
    }
    setDrafts([...drafts, newDraft])
    try {
      const result = await upsert.mutateAsync({
        workout_id: workoutId,
        exercise_id: newDraft.exercise_id,
        set_number: newDraft.set_number,
        weight_kg: newDraft.weight_kg,
        reps: newDraft.reps,
        rir: newDraft.rir,
        is_warmup: newDraft.is_warmup,
      })
      setDrafts((prev) => {
        const next = [...prev]
        const idx = next.findIndex((d) => d.set_number === newDraft.set_number && !d.id)
        if (idx >= 0) {
          next[idx] = { ...next[idx], id: result.id }
        }
        return next
      })
      toast.success('Set added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add set')
    }
  }

  const deleteSet = async (index: number) => {
    const draft = drafts[index]
    if (draft.id) {
      try {
        await remove.mutateAsync({ id: draft.id, workoutId })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete set')
        return
      }
    }
    setDrafts((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, set_number: i + 1 })),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.map((draft, index) => (
          <div key={`${draft.id ?? 'new'}-${draft.set_number}`} className="rounded-lg border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Set {draft.set_number}</span>
              <div className="flex items-center gap-2">
                {draft.is_warmup && <Badge variant="secondary">Warmup</Badge>}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-500 hover:text-red-400"
                  onClick={() => deleteSet(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">kg</Label>
                <NumericInput
                  value={draft.weight_kg}
                  onValueChange={(v) => updateDraft(index, { weight_kg: v })}
                  onBlur={() => saveDraft(drafts[index])}
                  min={0}
                  allowDecimal
                />
              </div>
              <div>
                <Label className="text-xs">Reps</Label>
                <NumericInput
                  value={draft.reps}
                  onValueChange={(v) => updateDraft(index, { reps: v })}
                  onBlur={() => saveDraft(drafts[index])}
                  min={0}
                  max={999}
                />
              </div>
              <div>
                <Label className="text-xs">RIR</Label>
                <NumericInput
                  value={draft.rir}
                  onValueChange={(v) => updateDraft(index, { rir: v })}
                  onBlur={() => saveDraft(drafts[index])}
                  min={0}
                  max={10}
                />
              </div>
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

export function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: workout, isLoading } = useWorkout(id)
  const deleteWorkout = useDeleteWorkout()
  const [isEditing, setIsEditing] = useState(false)

  const grouped = useMemo(() => {
    if (!workout?.workout_sets) return []
    const map = new Map<string, typeof workout.workout_sets>()
    for (const s of workout.workout_sets) {
      const list = map.get(s.exercise_id) ?? []
      list.push(s)
      map.set(s.exercise_id, list)
    }
    return Array.from(map.entries()).map(([exerciseId, sets]) => ({
      exerciseId,
      name: sets[0]?.exercise?.name ?? 'Exercise',
      sets: sets.sort((a, b) => a.set_number - b.set_number),
    }))
  }, [workout])

  // Also add exercise groups from template that have no sets yet (for adding sets in edit mode)
  const allExerciseGroups = useMemo(() => {
    if (!workout) return grouped
    const templateExercises = (workout.template as any)?.template_exercises ?? []
    const existingIds = new Set(grouped.map((g) => g.exerciseId))
    const missing = templateExercises
      .filter((te: any) => !existingIds.has(te.exercise_id))
      .map((te: any) => ({
        exerciseId: te.exercise_id as string,
        name: (te.exercise?.name ?? 'Exercise') as string,
        sets: [] as WorkoutSet[],
      }))
    return [...grouped, ...missing]
  }, [workout, grouped])

  const handleDelete = async () => {
    if (!id || !workout) return
    const name = workout.template?.name ?? 'Workout'
    if (!confirm(`Delete "${name}" from history? This cannot be undone.`)) return
    try {
      await deleteWorkout.mutateAsync(id)
      toast.success('Workout deleted')
      navigate('/history')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete workout')
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!workout) return <p>Workout not found</p>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/history" className="text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{workout.template?.name ?? 'Workout'}</h1>
            <p className="text-sm text-slate-400">
              {formatDateTime(workout.completed_at ?? workout.started_at)}
              {workout.completed_at && ` · ${formatDuration(workout.started_at, workout.completed_at)}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? (
              <><X className="h-4 w-4" /> Done</>
            ) : (
              <><Pencil className="h-4 w-4" /> Edit</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-red-500/50 text-red-400 hover:bg-red-500/10"
            disabled={deleteWorkout.isPending}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {isEditing ? (
          allExerciseGroups.map(({ exerciseId, name, sets }) => (
            <EditableExerciseBlock
              key={exerciseId}
              exerciseId={exerciseId}
              name={name}
              sets={sets}
              workoutId={workout.id}
            />
          ))
        ) : (
          grouped.map(({ exerciseId, name, sets }) => (
            <Card key={exerciseId}>
              <CardHeader>
                <CardTitle>{name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sets.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-sm">
                    <span className="text-slate-400">Set {s.set_number}</span>
                    <div className="flex items-center gap-3">
                      {s.is_warmup && <Badge variant="secondary">Warmup</Badge>}
                      <span className="font-medium">{s.weight_kg} kg × {s.reps}</span>
                      <span className="text-slate-400">RIR {s.rir}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
