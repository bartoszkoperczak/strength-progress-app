import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Exercise, ExerciseCategory, MovementType } from '@/types/database'

function formatSupabaseError(error: { message: string; code?: string; details?: string }) {
  if (error.code === '23505') return 'An exercise with this name already exists.'
  return error.message
}

export function useEnsureDefaultExercises() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('ensure_default_exercises')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useExercises(includeArchived = false) {
  return useQuery({
    queryKey: ['exercises', includeArchived],
    queryFn: async () => {
      let query = supabase.from('exercises').select('*').order('is_system', { ascending: false }).order('name')
      if (!includeArchived) query = query.eq('is_archived', false)
      const { data, error } = await query
      if (error) throw error
      return data as Exercise[]
    },
  })
}

export function useCreateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      category: ExerciseCategory
      movement_type: MovementType
      is_compound: boolean
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          ...input,
          user_id: user.id,
          is_system: false,
          slug: null,
        })
        .select()
        .single()
      if (error) throw new Error(formatSupabaseError(error))
      return data as Exercise
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useUpdateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_system, slug, ...input }: Partial<Exercise> & { id: string }) => {
      const { data, error } = await supabase
        .from('exercises')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(formatSupabaseError(error))
      return data as Exercise
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (exercise: Exercise) => {
      if (exercise.is_system) {
        throw new Error('System exercises cannot be removed.')
      }
      const { count } = await supabase
        .from('workout_sets')
        .select('*', { count: 'exact', head: true })
        .eq('exercise_id', exercise.id)
      if (count && count > 0) {
        const { error } = await supabase.from('exercises').update({ is_archived: true }).eq('id', exercise.id)
        if (error) throw new Error(formatSupabaseError(error))
        return 'archived'
      }
      const { error } = await supabase.from('exercises').delete().eq('id', exercise.id)
      if (error) throw new Error(formatSupabaseError(error))
      return 'deleted'
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}
