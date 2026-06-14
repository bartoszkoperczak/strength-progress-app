import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name)
      })
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Profile updated')
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-slate-400">{user?.email}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Display name</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Link to="/one-rep-max" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800">
            <Calculator className="h-4 w-4" /> 1RM calculator
          </Link>
        </CardContent>
      </Card>

      <Button variant="destructive" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  )
}
