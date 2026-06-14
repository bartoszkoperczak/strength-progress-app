import { Link, useNavigate } from 'react-router-dom'
import { Play, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useTemplates } from '@/features/templates/api'
import { useInProgressWorkout, useStartWorkout } from '@/features/workouts/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function WorkoutStartPage() {
  const navigate = useNavigate()
  const { data: templates, isLoading } = useTemplates(true)
  const { data: inProgress } = useInProgressWorkout()
  const startWorkout = useStartWorkout()

  const handleStart = async (templateId: string) => {
    try {
      const workout = await startWorkout.mutateAsync(templateId)
      navigate(`/workout/${workout.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start workout')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Start Workout</h1>
        <p className="text-slate-400">Choose an active template to begin</p>
      </div>

      {inProgress && (
        <Card className="border-emerald-500/50 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" /> Workout in progress
            </CardTitle>
            <CardDescription>{inProgress.template?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to={`/workout/${inProgress.id}`}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Resume workout
            </Link>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {templates?.map((t) => (
            <Card key={t.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{t.name}</p>
                {t.description && <p className="text-sm text-slate-400">{t.description}</p>}
              </div>
              <Button onClick={() => handleStart(t.id)} disabled={startWorkout.isPending}>
                <Play className="h-4 w-4" /> Start
              </Button>
            </Card>
          ))}
          {templates?.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              <p>No active templates.</p>
              <Link to="/templates" className="mt-2 inline-block text-emerald-400 hover:underline">
                Create a template
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
