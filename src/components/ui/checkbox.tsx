import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'checkbox', ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'h-5 w-5 rounded border-slate-600 bg-slate-900 text-emerald-600 focus:ring-emerald-500',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Checkbox.displayName = 'Checkbox'
