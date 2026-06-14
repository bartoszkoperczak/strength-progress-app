import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-emerald-600/20 text-emerald-400',
        variant === 'secondary' && 'bg-slate-700 text-slate-300',
        variant === 'outline' && 'border border-slate-600 text-slate-300',
        className,
      )}
      {...props}
    />
  )
}
