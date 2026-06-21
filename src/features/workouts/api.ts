import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LastPerformance, Workout, WorkoutSet, WorkoutWithSets } from '@/types/database'
import { calculateExercisePRRecords } from '@/lib/pr'


export function useWorkouts(status?: string) {
  return useQuery({
    queryKey: ['workouts', status],
    queryFn: async () => {
      let query = supabase
        .from('workouts')
        .select('*, template:templates(name)')
        .order('started_at', { ascending: false })
      if (status) query = query.eq('status', status)
      const { data, error } = await query
      if (error) throw error
      return data as (Workout & { template: { name: string } })[]
    },
  })
}

export function useWorkout(id: string | undefined) {
  return useQuery({
    queryKey: ['workout', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*, template:templates(*, template_exercises(*, exercise:exercises(*))), workout_sets(*, exercise:exercises(*))')
        .eq('id', id!)
        .single()
      if (error) throw error
      const workout = data as WorkoutWithSets & {
        template: {
          template_exercises: Array<{
            exercise_id: string
            target_sets: number
            target_reps: number
            sort_order: number
            exercise: { name: string }
          }>
        }
      }
      workout.workout_sets.sort((a, b) => a.set_number - b.set_number)
      return workout
    },
  })
}

export function useInProgressWorkout() {
  return useQuery({
    queryKey: ['workout', 'in_progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*, template:templates(name)')
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as (Workout & { template: { name: string } }) | null
    },
  })
}

export function useStartWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('workouts')
        .insert({ user_id: user.id, template_id: templateId, status: 'in_progress' })
        .select()
        .single()
      if (error) throw error
      return data as Workout
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['workout', 'in_progress'] })
    },
  })
}

export function useCompleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workoutId: string) => {
      const { data, error } = await supabase
        .from('workouts')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', workoutId)
        .select()
        .single()
      if (error) throw error
      return data as Workout
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['workout'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['last-performance'] })
      qc.invalidateQueries({ queryKey: ['exercise-prs'] })
    },
  })
}

/**
 * Upsert a single workout set.
 * When `skipInvalidation` is true (used during active workout editing),
 * the workout query is NOT invalidated — the caller patches local state directly.
 */
export function useUpsertWorkoutSet(skipInvalidation = false) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      workout_id: string
      exercise_id: string
      set_number: number
      weight_kg: number
      reps: number
      rir: number
      is_warmup: boolean
    }) => {
      const { id, ...rest } = input
      if (id) {
        const { data, error } = await supabase
          .from('workout_sets')
          .update(rest)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as WorkoutSet
      }
      const { data, error } = await supabase
        .from('workout_sets')
        .insert(rest)
        .select()
        .single()
      if (error) throw error
      return data as WorkoutSet
    },
    onSuccess: (_, vars) => {
      if (!skipInvalidation) {
        qc.invalidateQueries({ queryKey: ['workout', vars.workout_id] })
      }
    },
  })
}

/**
 * Batch upsert workout sets — used when finishing an active workout
 * to ensure all local drafts are persisted.
 */
export function useBatchUpsertWorkoutSets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inputs: Array<{
      id?: string
      workout_id: string
      exercise_id: string
      set_number: number
      weight_kg: number
      reps: number
      rir: number
      is_warmup: boolean
    }>) => {
      const results: WorkoutSet[] = []
      for (const input of inputs) {
        const { id, ...rest } = input
        if (id) {
          const { data, error } = await supabase
            .from('workout_sets')
            .update(rest)
            .eq('id', id)
            .select()
            .single()
          if (error) throw error
          results.push(data as WorkoutSet)
        } else {
          const { data, error } = await supabase
            .from('workout_sets')
            .insert(rest)
            .select()
            .single()
          if (error) throw error
          results.push(data as WorkoutSet)
        }
      }
      return results
    },
    onSuccess: (_, vars) => {
      const workoutId = vars[0]?.workout_id
      if (workoutId) {
        qc.invalidateQueries({ queryKey: ['workout', workoutId] })
      }
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['last-performance'] })
      qc.invalidateQueries({ queryKey: ['exercise-prs'] })
    },
  })
}

export function useDeleteWorkoutSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, workoutId }: { id: string; workoutId: string }) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', id)
      if (error) throw error
      return workoutId
    },
    onSuccess: (workoutId) => {
      qc.invalidateQueries({ queryKey: ['workout', workoutId] })
    },
  })
}

export function useDeleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['workout'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['last-performance'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'sets'] })
      qc.invalidateQueries({ queryKey: ['exercise-prs'] })
    },
  })
}

/**
 * Reopen a completed workout for editing.
 */
export function useReopenWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workoutId: string) => {
      const { data, error } = await supabase
        .from('workouts')
        .update({ status: 'in_progress', completed_at: null })
        .eq('id', workoutId)
        .select()
        .single()
      if (error) throw error
      return data as Workout
    },
    onSuccess: (_, workoutId) => {
      qc.invalidateQueries({ queryKey: ['workout', workoutId] })
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['workout', 'in_progress'] })
    },
  })
}

export function useLastPerformance(exerciseId: string | undefined) {
  return useQuery({
    queryKey: ['last-performance', exerciseId],
    enabled: Boolean(exerciseId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_last_performance', {
        p_exercise_id: exerciseId!,
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return row as LastPerformance | null
    },
  })
}

export function useAllLastPerformances() {
  return useQuery({
    queryKey: ['last-performance', 'all'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data, error } = await supabase
        .from('last_exercise_performance')
        .select('*')
        .eq('user_id', user.id)
      if (error) throw error
      return data as LastPerformance[]
    },
  })
}

export function useWorkoutSetsForDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'sets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*, workout:workouts!inner(status, completed_at, user_id, template_id, template:templates(name)), exercise:exercises(name)')
        .eq('workout.status', 'completed')
        .order('logged_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/**
 * Fetch the maximum weight ever lifted for each exercise
 * from completed workouts (excluding warmup sets).
 * Returns a Map<exerciseId, maxWeightKg>.
 */
export function useExerciseMaxWeights() {
  return useQuery({
    queryKey: ['exercise-max-weights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('exercise_id, weight_kg, workout:workouts!inner(status)')
        .eq('workout.status', 'completed')
        .eq('is_warmup', false)
        .order('weight_kg', { ascending: false })
      if (error) throw error

      const maxMap = new Map<string, number>()
      for (const row of data ?? []) {
        const weight = Number(row.weight_kg)
        const current = maxMap.get(row.exercise_id) ?? 0
        if (weight > current) {
          maxMap.set(row.exercise_id, weight)
        }
      }
      return maxMap
    },
  })
}

export function useExercisePRs() {
  return useQuery({
    queryKey: ['exercise-prs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*, workout:workouts!inner(status, completed_at)')
        .eq('workout.status', 'completed')
        .eq('is_warmup', false)
      if (error) throw error

      return calculateExercisePRRecords(data ?? [])
    },
  })
}


