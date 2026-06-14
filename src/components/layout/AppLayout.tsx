import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, ListOrdered, History, User, Plus, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OfflineBanner } from '@/hooks/useOnlineStatus'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/exercises', icon: BookOpen, label: 'Exercises' },
  { to: '/templates', icon: ListOrdered, label: 'Templates' },
  { to: '/workout', icon: Plus, label: 'Workout', highlight: true },
  { to: '/history', icon: History, label: 'History' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <OfflineBanner />
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-emerald-500" />
            <span className="text-lg font-bold">Strength Progress</span>
          </div>
          <nav className="hidden gap-1 md:flex">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-6 px-1 py-2">
          {navItems.map(({ to, icon: Icon, label, highlight }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] leading-tight',
                  highlight && 'text-emerald-400',
                  isActive ? 'text-emerald-400' : 'text-slate-500',
                )
              }
            >
              <Icon className={cn('h-5 w-5', highlight && 'h-6 w-6')} />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
