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

// ─── Template Export/Import ─────────────────────────────────────────────────────

export interface TemplateExportData {
  version: 1
  exported_at: string
  template: {
    name: string
    description: string | null
  }
  exercises: Array<{
    name: string
    slug: string | null
    category: string
    movement_type: string
    is_compound: boolean
    sort_order: number
    target_sets: number
    target_reps: number
    notes: string | null
  }>
}

export function useExportTemplate() {
  return useMutation({
    mutationFn: async (templateId: string): Promise<TemplateExportData> => {
      const { data, error } = await supabase
        .from('templates')
        .select('*, template_exercises(*, exercise:exercises(*))')
        .eq('id', templateId)
        .single()
      if (error) throw error

      const template = data as TemplateWithExercises
      const exercises = [...template.template_exercises]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((te) => ({
          name: te.exercise?.name ?? 'Unknown',
          slug: te.exercise?.slug ?? null,
          category: te.exercise?.category ?? 'Other',
          movement_type: te.exercise?.movement_type ?? 'barbell',
          is_compound: te.exercise?.is_compound ?? false,
          sort_order: te.sort_order,
          target_sets: te.target_sets,
          target_reps: te.target_reps,
          notes: te.notes ?? null,
        }))

      return {
        version: 1,
        exported_at: new Date().toISOString(),
        template: {
          name: template.name,
          description: template.description,
        },
        exercises,
      }
    },
  })
}

export function useImportTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (exportData: TemplateExportData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // 1. Create the template
      const { data: newTemplate, error: tplError } = await supabase
        .from('templates')
        .insert({
          user_id: user.id,
          name: exportData.template.name,
          description: exportData.template.description,
          is_active: true,
        })
        .select()
        .single()
      if (tplError) throw tplError

      // 2. For each exercise, find or create it
      const exerciseIds: string[] = []
      for (const ex of exportData.exercises) {
        // Try to find by slug first
        if (ex.slug) {
          const { data: existing } = await supabase
            .from('exercises')
            .select('id')
            .eq('user_id', user.id)
            .eq('slug', ex.slug)
            .maybeSingle()
          if (existing) {
            exerciseIds.push(existing.id)
            continue
          }
        }

        // Try to find by name (case-insensitive)
        const { data: byName } = await supabase
          .from('exercises')
          .select('id')
          .eq('user_id', user.id)
          .ilike('name', ex.name)
          .maybeSingle()
        if (byName) {
          exerciseIds.push(byName.id)
          continue
        }

        // Create new exercise
        const { data: created, error: exError } = await supabase
          .from('exercises')
          .insert({
            user_id: user.id,
            name: ex.name,
            category: ex.category,
            movement_type: ex.movement_type,
            is_compound: ex.is_compound,
            is_system: false,
            slug: null,
          })
          .select()
          .single()
        if (exError) throw exError
        exerciseIds.push(created.id)
      }

      // 3. Create template_exercises
      const templateExercises = exportData.exercises.map((ex, i) => ({
        template_id: newTemplate.id,
        exercise_id: exerciseIds[i],
        sort_order: ex.sort_order,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        notes: ex.notes,
      }))

      if (templateExercises.length > 0) {
        const { error: teError } = await supabase
          .from('template_exercises')
          .insert(templateExercises)
        if (teError) throw teError
      }

      return newTemplate as Template
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['exercises'] })
    },
  })
}
