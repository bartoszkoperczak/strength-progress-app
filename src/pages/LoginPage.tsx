import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dumbbell } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  const { resetPassword } = useAuth()

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    if (resetMode) {
      const { error } = await resetPassword(data.email)
      setLoading(false)
      if (error) toast.error(error)
      else toast.success('Password reset email sent')
      return
    }
    const { error } = await signIn(data.email, data.password)
    setLoading(false)
    if (error) toast.error(error)
    else navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/20">
            <Dumbbell className="h-6 w-6 text-emerald-500" />
          </div>
          <CardTitle>{resetMode ? 'Reset password' : 'Welcome back'}</CardTitle>
          <CardDescription>
            {resetMode ? 'Enter your email to receive a reset link' : 'Sign in to track your strength progress'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
            </div>
            {!resetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
                {errors.password && <p className="text-sm text-red-400">{errors.password.message}</p>}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : resetMode ? 'Send reset link' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-4 space-y-2 text-center text-sm text-slate-400">
            <button type="button" className="text-emerald-400 hover:underline" onClick={() => setResetMode(!resetMode)}>
              {resetMode ? 'Back to sign in' : 'Forgot password?'}
            </button>
            {!resetMode && (
              <p>
                No account?{' '}
                <Link to="/signup" className="text-emerald-400 hover:underline">
                  Sign up
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
