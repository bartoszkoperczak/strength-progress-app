import { useState } from 'react'
import { Plus, Pencil, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { useExercises, useCreateExercise, useUpdateExercise, useDeleteExercise } from '@/features/exercises/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Exercise, ExerciseCategory, MovementType } from '@/types/database'

const categories: ExerciseCategory[] = ['Push', 'Pull', 'Legs', 'Core', 'Other']
const movementTypes: MovementType[] = ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable']

const emptyForm = {
  name: '',
  category: 'Other' as ExerciseCategory,
  movement_type: 'barbell' as MovementType,
  is_compound: false,
}

export function ExercisesPage() {
  const { data: exercises, isLoading, error } = useExercises()
  const createExercise = useCreateExercise()
  const updateExercise = useUpdateExercise()
  const deleteExercise = useDeleteExercise()
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const clearForm = () => {
    setForm(emptyForm)
    setEditing(null)
  }

  const openCreateForm = () => {
    clearForm()
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    clearForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      if (editing) {
        const updates = editing.is_system
          ? { category: form.category, movement_type: form.movement_type, is_compound: form.is_compound }
          : form
        await updateExercise.mutateAsync({ id: editing.id, ...updates })
        toast.success('Exercise updated')
      } else {
        await createExercise.mutateAsync(form)
        toast.success('Exercise created')
      }
      closeForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const handleDelete = async (ex: Exercise) => {
    try {
      const result = await deleteExercise.mutateAsync(ex)
      toast.success(result === 'archived' ? 'Exercise archived (used in history)' : 'Exercise deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const startEdit = (ex: Exercise) => {
    setEditing(ex)
    setForm({
      name: ex.name,
      category: ex.category,
      movement_type: ex.movement_type,
      is_compound: ex.is_compound,
    })
    setShowForm(true)
  }

  const systemExercises = exercises?.filter((e) => e.is_system) ?? []
  const customExercises = exercises?.filter((e) => !e.is_system) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exercises</h1>
          <p className="text-slate-400">System lifts for 1RM tracking + your custom exercises</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4" /> Add custom
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-300">
            Failed to load exercises: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit exercise' : 'New custom exercise'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  disabled={editing?.is_system}
                  placeholder="e.g. Romanian Deadlift"
                />
                {editing?.is_system && (
                  <p className="text-xs text-slate-400">System lift names are fixed for 1RM compatibility.</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExerciseCategory })}>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Movement type</Label>
                  <Select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value as MovementType })}>
                    {movementTypes.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.is_compound} onChange={(e) => setForm({ ...form, is_compound: e.target.checked })} />
                Compound lift
              </label>
              <div className="flex gap-2">
                <Button type="submit" disabled={createExercise.isPending || updateExercise.isPending}>
                  {editing ? 'Save' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {systemExercises.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">System lifts (1RM)</h2>
              {systemExercises.map((ex) => (
                <ExerciseRow key={ex.id} ex={ex} onEdit={startEdit} onDelete={handleDelete} />
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Your exercises</h2>
            {customExercises.map((ex) => (
              <ExerciseRow key={ex.id} ex={ex} onEdit={startEdit} onDelete={handleDelete} />
            ))}
            {customExercises.length === 0 && (
              <p className="py-6 text-center text-slate-400">
                No custom exercises yet. Click &quot;Add custom&quot; to create one for your templates.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function ExerciseRow({
  ex,
  onEdit,
  onDelete,
}: {
  ex: Exercise
  onEdit: (ex: Exercise) => void
  onDelete: (ex: Exercise) => void
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{ex.name}</span>
          {ex.is_system && <Badge>System · 1RM</Badge>}
          {ex.is_compound && !ex.is_system && <Badge variant="secondary">Compound</Badge>}
        </div>
        <p className="text-sm text-slate-400">{ex.category} · {ex.movement_type}</p>
      </div>
      <div className="flex gap-2">
        <Button size="icon" variant="ghost" onClick={() => onEdit(ex)}>
          <Pencil className="h-4 w-4" />
        </Button>
        {!ex.is_system && (
          <Button size="icon" variant="ghost" onClick={() => onDelete(ex)}>
            <Archive className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}
