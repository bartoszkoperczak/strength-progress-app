import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Exercise, ExerciseCategory, MovementType } from '@/types/database'

export function useExercises(includeArchived = false) {
  return useQuery({
    queryKey: ['exercises', includeArchived],
    queryFn: async () => {
      let query = supabase.from('exercises').select('*').order('name')
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
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Exercise
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useUpdateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Exercise> & { id: string }) => {
      const { data, error } = await supabase
        .from('exercises')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Exercise
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from('workout_sets')
        .select('*', { count: 'exact', head: true })
        .eq('exercise_id', id)
      if (count && count > 0) {
        const { error } = await supabase.from('exercises').update({ is_archived: true }).eq('id', id)
        if (error) throw error
        return 'archived'
      }
      const { error } = await supabase.from('exercises').delete().eq('id', id)
      if (error) throw error
      return 'deleted'
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}
