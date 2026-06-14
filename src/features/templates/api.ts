import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Template, TemplateExercise, TemplateWithExercises } from '@/types/database'

export function useTemplates(activeOnly = false) {
  return useQuery({
    queryKey: ['templates', activeOnly],
    queryFn: async () => {
      let query = supabase.from('templates').select('*').order('sort_order').order('name')
      if (activeOnly) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return data as Template[]
    },
  })
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['template', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*, template_exercises(*, exercise:exercises(*))')
        .eq('id', id!)
        .single()
      if (error) throw error
      const template = data as TemplateWithExercises
      template.template_exercises.sort((a, b) => a.sort_order - b.sort_order)
      return template
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('templates')
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Template
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Template> & { id: string }) => {
      const { data, error } = await supabase
        .from('templates')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Template
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['template', vars.id] })
    },
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })
}

export function useDuplicateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data: template, error } = await supabase
        .from('templates')
        .select('*, template_exercises(*)')
        .eq('id', templateId)
        .single()
      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: newTemplate, error: createError } = await supabase
        .from('templates')
        .insert({
          user_id: user.id,
          name: `${template.name} (copy)`,
          description: template.description,
          is_active: false,
        })
        .select()
        .single()
      if (createError) throw createError

      const exercises = (template.template_exercises as TemplateExercise[]) ?? []
      if (exercises.length > 0) {
        const { error: teError } = await supabase.from('template_exercises').insert(
          exercises.map((te) => ({
            template_id: newTemplate.id,
            exercise_id: te.exercise_id,
            sort_order: te.sort_order,
            target_sets: te.target_sets,
            target_reps: te.target_reps,
            notes: te.notes,
          })),
        )
        if (teError) throw teError
      }

      return newTemplate as Template
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })
}

export function useUpsertTemplateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      template_id: string
      exercise_id: string
      sort_order: number
      target_sets: number
      target_reps: number
      notes?: string | null
      id?: string
    }) => {
      const { id, ...rest } = input
      if (id) {
        const { data, error } = await supabase
          .from('template_exercises')
          .update(rest)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase
        .from('template_exercises')
        .insert(rest)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['template', vars.template_id] })
    },
  })
}

export function useDeleteTemplateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, templateId }: { id: string; templateId: string }) => {
      const { error } = await supabase.from('template_exercises').delete().eq('id', id)
      if (error) throw error
      return templateId
    },
    onSuccess: (templateId) => {
      qc.invalidateQueries({ queryKey: ['template', templateId] })
    },
  })
}

export function useReorderTemplateExercises() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: Array<{ id: string; sort_order: number; template_id: string }>) => {
      const updates = items.map(({ id, sort_order }) =>
        supabase.from('template_exercises').update({ sort_order }).eq('id', id),
      )
      const results = await Promise.all(updates)
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
      return items[0]?.template_id
    },
    onSuccess: (templateId) => {
      if (templateId) qc.invalidateQueries({ queryKey: ['template', templateId] })
    },
  })
}
