import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Copy, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
} from '@/features/templates/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates()
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()
  const duplicateTemplate = useDuplicateTemplate()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const t = await createTemplate.mutateAsync({ name, description: description || undefined })
      toast.success('Template created')
      setName('')
      setDescription('')
      setShowForm(false)
      window.location.href = `/templates/${t.id}`
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create')
    }
  }

  const toggleActive = async (id: string, is_active: boolean) => {
    try {
      await updateTemplate.mutateAsync({ id, is_active })
      toast.success(is_active ? 'Template activated' : 'Template deactivated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate.mutateAsync(id)
      toast.success('Template duplicated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try {
      await deleteTemplate.mutateAsync(id)
      toast.success('Template deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-slate-400">Create and manage workout templates</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New template</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {templates?.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/templates/${t.id}`} className="text-lg font-semibold hover:text-emerald-400">
                      {t.name}
                    </Link>
                    {!t.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {t.description && <p className="mt-1 text-sm text-slate-400">{t.description}</p>}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      Active
                      <Switch checked={t.is_active} onCheckedChange={(v) => toggleActive(t.id, v)} />
                    </label>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Link
                    to={`/templates/${t.id}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <Button size="icon" variant="ghost" onClick={() => handleDuplicate(t.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {templates?.length === 0 && (
            <p className="py-8 text-center text-slate-400">No templates yet. Create your first workout template!</p>
          )}
        </div>
      )}
    </div>
  )
}
