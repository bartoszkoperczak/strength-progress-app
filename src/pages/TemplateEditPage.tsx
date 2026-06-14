import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  useTemplate,
  useUpsertTemplateExercise,
  useDeleteTemplateExercise,
  useReorderTemplateExercises,
  useUpdateTemplate,
} from '@/features/templates/api'
import { useExercises } from '@/features/exercises/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { TemplateExercise } from '@/types/database'

function SortableExercise({
  item,
  onUpdate,
  onDelete,
}: {
  item: TemplateExercise & { exercise?: { name: string } }
  onUpdate: (id: string, target_sets: number, target_reps: number) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <button type="button" className="cursor-grab touch-none text-slate-500" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <p className="font-medium">{item.exercise?.name ?? 'Exercise'}</p>
        <div className="mt-2 flex gap-3">
          <div className="flex items-center gap-1">
            <Label className="text-xs">Sets</Label>
            <Input
              type="number"
              className="h-9 w-16"
              value={item.target_sets}
              onChange={(e) => onUpdate(item.id, Number(e.target.value), item.target_reps)}
            />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-xs">Reps</Label>
            <Input
              type="number"
              className="h-9 w-16"
              value={item.target_reps}
              onChange={(e) => onUpdate(item.id, item.target_sets, Number(e.target.value))}
            />
          </div>
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={() => onDelete(item.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function TemplateEditPage() {
  const { id } = useParams<{ id: string }>()
  const { data: template, isLoading } = useTemplate(id)
  const { data: exercises } = useExercises()
  const upsert = useUpsertTemplateExercise()
  const remove = useDeleteTemplateExercise()
  const reorder = useReorderTemplateExercises()
  const updateTemplate = useUpdateTemplate()
  const [selectedExercise, setSelectedExercise] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const items = template?.template_exercises ?? []
  const usedIds = new Set(items.map((i) => i.exercise_id))
  const available = exercises?.filter((e) => !usedIds.has(e.id)) ?? []

  const handleAdd = async () => {
    if (!selectedExercise || !id) return
    try {
      await upsert.mutateAsync({
        template_id: id,
        exercise_id: selectedExercise,
        sort_order: items.length,
        target_sets: 3,
        target_reps: 8,
      })
      setSelectedExercise('')
      toast.success('Exercise added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add')
    }
  }

  const handleUpdate = async (teId: string, target_sets: number, target_reps: number) => {
    const item = items.find((i) => i.id === teId)
    if (!item || !id) return
    await upsert.mutateAsync({
      id: teId,
      template_id: id,
      exercise_id: item.exercise_id,
      sort_order: item.sort_order,
      target_sets,
      target_reps,
    })
  }

  const handleDelete = async (teId: string) => {
    if (!id) return
    try {
      await remove.mutateAsync({ id: teId, templateId: id })
      toast.success('Exercise removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    try {
      await reorder.mutateAsync(
        reordered.map((item, index) => ({ id: item.id, sort_order: index, template_id: id })),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder')
    }
  }

  const saveName = async (name: string) => {
    if (!id) return
    await updateTemplate.mutateAsync({ id, name })
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!template) return <p>Template not found</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/templates" className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <Input
            className="text-xl font-bold"
            defaultValue={template.name}
            onBlur={(e) => saveName(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Exercises</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select
              className="flex-1"
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
            >
              <option value="">Select exercise...</option>
              {available.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Button onClick={handleAdd} disabled={!selectedExercise}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map((item) => (
                  <SortableExercise
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {items.length === 0 && (
            <p className="py-4 text-center text-slate-400">No exercises in this template yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
