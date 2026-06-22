import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Flame, Trophy } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'
import { useWorkouts, useWorkoutSetsForDashboard } from '@/features/workouts/api'
import { useExercises } from '@/features/exercises/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { bestSetOneRm } from '@/lib/one-rm'
import { getProgressionSuggestions, suggestionColor, type SessionData, type SessionSet } from '@/lib/progression'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { data: workouts, isLoading: loadingWorkouts } = useWorkouts('completed')
  const { data: sets, isLoading: loadingSets } = useWorkoutSetsForDashboard()
  const { data: exercises } = useExercises()
  const [selectedExercise, setSelectedExercise] = useState('')

  const weeklyVolume = useMemo(() => {
    if (!sets) return []
    const weeks = new Map<string, number>()
    for (const s of sets) {
      if (s.is_warmup) continue
      const w = s.workout as { completed_at: string }
      if (!w?.completed_at) continue
      const date = new Date(w.completed_at)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const key = weekStart.toISOString().slice(0, 10)
      const vol = Number(s.weight_kg) * s.reps
      weeks.set(key, (weeks.get(key) ?? 0) + vol)
    }
    return Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, volume]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        volume: Math.round(volume),
      }))
  }, [sets])

  const exerciseId = selectedExercise || exercises?.[0]?.id || ''

  const oneRmTrend = useMemo(() => {
    if (!sets || !exerciseId) return []
    const byWorkout = new Map<string, { date: string; sets: typeof sets }>()
    for (const s of sets) {
      if (s.exercise_id !== exerciseId || s.is_warmup) continue
      const w = s.workout as { id: string; completed_at: string }
      if (!w?.completed_at) continue
      const list = byWorkout.get(w.id)?.sets ?? []
      list.push(s)
      byWorkout.set(w.id, { date: w.completed_at, sets: list })
    }
    return Array.from(byWorkout.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map(({ date, sets: wSets }) => {
        const best = bestSetOneRm(wSets.map((s) => ({
          weight_kg: Number(s.weight_kg),
          reps: s.reps,
          rir: s.rir,
          is_warmup: s.is_warmup,
        })))
        return {
          date: formatDate(date),
          oneRm: best?.recommended ?? 0,
        }
      })
      .filter((d) => d.oneRm > 0)
  }, [sets, exerciseId])

  const prFeed = useMemo(() => {
    if (!sets) return []
    const maxByExercise = new Map<string, { weight: number; name: string; date: string }>()
    for (const s of sets) {
      if (s.is_warmup) continue
      const ex = s.exercise as { name: string }
      const w = s.workout as { completed_at: string }
      const prev = maxByExercise.get(s.exercise_id)
      const weight = Number(s.weight_kg)
      if (!prev || weight > prev.weight) {
        maxByExercise.set(s.exercise_id, {
          weight,
          name: ex?.name ?? 'Exercise',
          date: w?.completed_at ?? '',
        })
      }
    }
    return Array.from(maxByExercise.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  }, [sets])

  const suggestions = useMemo(() => {
    if (!sets || !workouts) return []
    const sessionMap = new Map<string, SessionData>()
    for (const s of sets) {
      const w = s.workout as { id: string; completed_at: string }
      if (!w?.completed_at) continue
      const ex = s.exercise as { name: string }
      const key = `${w.id}-${s.exercise_id}`
      const existing: SessionData = sessionMap.get(key) ?? {
        exerciseId: s.exercise_id,
        exerciseName: ex?.name ?? 'Exercise',
        targetReps: 8,
        sets: [] as SessionSet[],
        completedAt: w.completed_at,
      }
      existing.sets.push({ reps: s.reps, rir: s.rir, is_warmup: s.is_warmup, weight_kg: Number(s.weight_kg) })
      sessionMap.set(key, existing)
    }
    const sessions = Array.from(sessionMap.values())
    const lastWorkout = workouts?.[0]
    const daysSince = lastWorkout?.completed_at
      ? Math.floor((Date.now() - new Date(lastWorkout.completed_at).getTime()) / 86400000)
      : null
    return getProgressionSuggestions(sessions, daysSince)
  }, [sets, workouts])

  const streak = useMemo(() => {
    if (!workouts?.length) return 0
    let count = 0
    const now = new Date()
    for (let i = 0; i < 52; i++) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay() - i * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)
      const hasWorkout = workouts.some((w) => {
        if (!w.completed_at) return false
        const d = new Date(w.completed_at)
        return d >= weekStart && d < weekEnd
      })
      if (hasWorkout) count++
      else if (i > 0) break
    }
    return count
  }, [workouts])

  const isLoading = loadingWorkouts || loadingSets

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400">Your strength progress at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <Flame className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold">{workouts?.length ?? 0}</p>
              <p className="text-sm text-slate-400">Total workouts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <TrendingUp className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold">{streak}</p>
              <p className="text-sm text-slate-400">Week streak</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <Trophy className="h-8 w-8 text-amber-400" />
            <div>
              <p className="text-2xl font-bold">{prFeed.length}</p>
              <p className="text-sm text-slate-400">Exercise PRs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Progression suggestions</h2>
          {suggestions.map((s, i) => (
            <Card key={i} className={cn('border', suggestionColor(s.type))}>
              <CardContent className="py-3">
                <p className="font-medium">{s.exerciseName}</p>
                <p className="text-sm text-slate-300">{s.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Weekly volume (kg × reps)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {isLoading ? <Skeleton className="h-full w-full" /> : weeklyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none' }} />
                <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-slate-400">Complete a workout to see volume data</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Estimated 1RM trend</CardTitle>
          <Select
            className="w-48"
            value={exerciseId}
            onChange={(e) => setSelectedExercise(e.target.value)}
          >
            {exercises?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </CardHeader>
        <CardContent className="h-64">
          {oneRmTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={oneRmTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none' }} />
                <Line type="monotone" dataKey="oneRm" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-slate-400">No data for this exercise yet</p>
          )}
        </CardContent>
      </Card>

      {prFeed.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Personal records</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {prFeed.map((pr, i) => (
              <div key={i} className="flex justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                <span>{pr.name}</span>
                <span className="font-semibold text-emerald-400">{pr.weight} kg</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link to="/workout" className="text-emerald-400 hover:underline">Start a workout →</Link>
        <Link to="/one-rep-max" className="text-emerald-400 hover:underline">1RM calculator →</Link>
      </div>
    </div>
  )
}
