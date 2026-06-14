import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkouts, useDeleteWorkout } from '@/features/workouts/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatDuration } from '@/lib/utils'

export function HistoryPage() {
  const { data: workouts, isLoading } = useWorkouts('completed')
  const deleteWorkout = useDeleteWorkout()

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" from history? This cannot be undone.`)) return
    try {
      await deleteWorkout.mutateAsync(id)
      toast.success('Workout deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete workout')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-slate-400">Your completed workouts</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {workouts?.map((w) => {
            const name = w.template?.name ?? 'Workout'
            return (
              <Card key={w.id} className="p-4 transition-colors hover:border-slate-700">
                <CardContent className="flex items-center gap-3 p-0">
                  <Link to={`/history/${w.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold">{name}</p>
                    <p className="text-sm text-slate-400">{formatDateTime(w.completed_at ?? w.started_at)}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {w.completed_at && (
                      <span className="hidden text-sm text-slate-400 sm:inline">
                        {formatDuration(w.started_at, w.completed_at)}
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-400"
                      disabled={deleteWorkout.isPending}
                      onClick={() => handleDelete(w.id, name)}
                      aria-label={`Delete ${name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {workouts?.length === 0 && (
            <p className="py-8 text-center text-slate-400">No completed workouts yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
