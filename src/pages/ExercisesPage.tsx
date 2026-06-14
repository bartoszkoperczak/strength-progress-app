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

export function ExercisesPage() {
  const { data: exercises, isLoading } = useExercises()
  const createExercise = useCreateExercise()
  const updateExercise = useUpdateExercise()
  const deleteExercise = useDeleteExercise()
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    category: 'Other' as ExerciseCategory,
    movement_type: 'barbell' as MovementType,
    is_compound: false,
  })

  const resetForm = () => {
    setForm({ name: '', category: 'Other', movement_type: 'barbell', is_compound: false })
    setEditing(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      if (editing) {
        await updateExercise.mutateAsync({ id: editing.id, ...form })
        toast.success('Exercise updated')
      } else {
        await createExercise.mutateAsync(form)
        toast.success('Exercise created')
      }
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteExercise.mutateAsync(id)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exercises</h1>
          <p className="text-slate-400">Manage your exercise library</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit exercise' : 'New exercise'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
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
                <Button type="submit">{editing ? 'Save' : 'Create'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
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
        <div className="space-y-2">
          {exercises?.map((ex) => (
            <Card key={ex.id} className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{ex.name}</span>
                  {ex.is_compound && <Badge>Compound</Badge>}
                </div>
                <p className="text-sm text-slate-400">{ex.category} · {ex.movement_type}</p>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" onClick={() => startEdit(ex)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(ex.id)}>
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          {exercises?.length === 0 && (
            <p className="text-center text-slate-400 py-8">No exercises yet. Add your first one!</p>
          )}
        </div>
      )}
    </div>
  )
}
