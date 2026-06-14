import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkout, useDeleteWorkout } from '@/features/workouts/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatDuration } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: workout, isLoading } = useWorkout(id)
  const deleteWorkout = useDeleteWorkout()

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

      <div className="space-y-4">
        {grouped.map(({ exerciseId, name, sets }) => (
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
        ))}
      </div>
    </div>
  )
}
