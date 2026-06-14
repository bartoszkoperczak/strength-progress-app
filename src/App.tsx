import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ExercisesPage } from '@/pages/ExercisesPage'
import { TemplatesPage } from '@/pages/TemplatesPage'
import { TemplateEditPage } from '@/pages/TemplateEditPage'
import { WorkoutStartPage } from '@/pages/WorkoutStartPage'
import { ActiveWorkoutPage } from '@/pages/ActiveWorkoutPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { HistoryDetailPage } from '@/pages/HistoryDetailPage'
import { OneRepMaxPage } from '@/pages/OneRepMaxPage'
import { ProfilePage } from '@/pages/ProfilePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/exercises" element={<ExercisesPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/templates/:id" element={<TemplateEditPage />} />
                <Route path="/workout" element={<WorkoutStartPage />} />
                <Route path="/workout/:id" element={<ActiveWorkoutPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/history/:id" element={<HistoryDetailPage />} />
                <Route path="/one-rep-max" element={<OneRepMaxPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}
