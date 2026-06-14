import { Link } from 'react-router-dom'
import { useWorkouts } from '@/features/workouts/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatDuration } from '@/lib/utils'

export function HistoryPage() {
  const { data: workouts, isLoading } = useWorkouts('completed')

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
          {workouts?.map((w) => (
            <Link key={w.id} to={`/history/${w.id}`}>
              <Card className="p-4 transition-colors hover:border-emerald-500/50">
                <CardContent className="flex items-center justify-between p-0">
                  <div>
                    <p className="font-semibold">{w.template?.name ?? 'Workout'}</p>
                    <p className="text-sm text-slate-400">{formatDateTime(w.completed_at ?? w.started_at)}</p>
                  </div>
                  {w.completed_at && (
                    <span className="text-sm text-slate-400">
                      {formatDuration(w.started_at, w.completed_at)}
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
          {workouts?.length === 0 && (
            <p className="py-8 text-center text-slate-400">No completed workouts yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
