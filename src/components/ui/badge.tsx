import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'pr'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-emerald-600/20 text-emerald-400',
        variant === 'secondary' && 'bg-slate-700 text-slate-300',
        variant === 'outline' && 'border border-slate-600 text-slate-300',
        variant === 'pr' && 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30',
        className,
      )}
      {...props}
    />
  )
}
