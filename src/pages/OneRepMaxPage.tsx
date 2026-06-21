import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useExercises } from '@/features/exercises/api'
import { useWorkoutSetsForDashboard } from '@/features/workouts/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericInput } from '@/components/ui/NumericInput'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { calculateOneRm, bestSetOneRm } from '@/lib/one-rm'
import { SYSTEM_LIFTS } from '@/types/database'
import { formatDate } from '@/lib/utils'

export function OneRepMaxPage() {
  const { data: exercises } = useExercises()
  const { data: sets } = useWorkoutSetsForDashboard()
  const [weight, setWeight] = useState(100)
  const [reps, setReps] = useState(5)
  const [rir, setRir] = useState(0)
  const [useRir, setUseRir] = useState(false)

  const manual = calculateOneRm({ weightKg: weight, reps, rir: useRir ? rir : 0 })

  const bigLiftCards = useMemo(() => {
    if (!exercises || !sets) return []
    return SYSTEM_LIFTS.map(({ slug, name }) => {
      const ex = exercises.find((e) => e.slug === slug || e.name === name)
      if (!ex) return { name, oneRm: null }
      const exSets = sets.filter((s) => s.exercise_id === ex.id && !s.is_warmup)
      const best = bestSetOneRm(exSets.map((s) => ({
        weight_kg: Number(s.weight_kg),
        reps: s.reps,
        rir: s.rir,
        is_warmup: s.is_warmup,
      })))
      return { name, oneRm: best?.recommended ?? null }
    })
  }, [exercises, sets])

  const [chartExercise, setChartExercise] = useState('')

  const chartData = useMemo(() => {
    const exId = chartExercise || exercises?.find((e) => e.slug === 'bench_press' || e.name === 'Bench Press')?.id
    if (!exId || !sets) return []
    const byWorkout = new Map<string, { date: string; sets: typeof sets }>()
    for (const s of sets) {
      if (s.exercise_id !== exId || s.is_warmup) continue
      const w = s.workout as { id: string; completed_at: string }
      if (!w?.completed_at) continue
      const list = byWorkout.get(w.id)?.sets ?? []
      list.push(s)
      byWorkout.set(w.id, { date: w.completed_at, sets: list })
    }
    return Array.from(byWorkout.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, sets: wSets }) => {
        const best = bestSetOneRm(wSets.map((s) => ({
          weight_kg: Number(s.weight_kg),
          reps: s.reps,
          rir: s.rir,
          is_warmup: s.is_warmup,
        })))
        return { date: formatDate(date), oneRm: best?.recommended ?? 0 }
      })
      .filter((d) => d.oneRm > 0)
  }, [sets, exercises, chartExercise])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">1RM Calculator</h1>
        <p className="text-slate-400">Estimate your one-rep max from submaximal sets</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bigLiftCards.map(({ name, oneRm }) => (
          <Card key={name}>
            <CardContent className="pt-4">
              <p className="text-sm text-slate-400">{name}</p>
              <p className="text-2xl font-bold text-emerald-400">
                {oneRm ? `${oneRm} kg` : '—'}
              </p>
              {oneRm && <Badge className="mt-1">PR estimate</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Manual calculator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <NumericInput value={weight} onValueChange={setWeight} min={0} allowDecimal />
            </div>
            <div className="space-y-2">
              <Label>Reps</Label>
              <NumericInput value={reps} onValueChange={setReps} min={1} max={100} />
            </div>
            <div className="space-y-2">
              <Label>RIR {useRir ? '' : '(disabled)'}</Label>
              <NumericInput value={rir} onValueChange={setRir} min={0} max={10} disabled={!useRir} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={useRir} onChange={(e) => setUseRir(e.target.checked)} />
            Adjust for RIR (effective reps = reps + RIR)
          </label>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Epley</p>
              <p className="text-lg font-bold">{manual.epley} kg</p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Brzycki</p>
              <p className="text-lg font-bold">{manual.brzycki} kg</p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Lombardi</p>
              <p className="text-lg font-bold">{manual.lombardi} kg</p>
            </div>
            <div className="rounded-lg bg-emerald-600/20 p-3 text-center">
              <p className="text-xs text-emerald-400">Recommended</p>
              <p className="text-lg font-bold text-emerald-400">{manual.recommended} kg</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>1RM history</CardTitle>
          <select
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            value={chartExercise}
            onChange={(e) => setChartExercise(e.target.value)}
          >
            <option value="">Bench Press</option>
            {exercises?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </CardHeader>
        <CardContent className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none' }} />
                <Line type="monotone" dataKey="oneRm" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-slate-400">Log workouts to see 1RM history</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
