import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface NumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onValueChange: (value: number) => void
  /** Minimum allowed value */
  min?: number
  /** Maximum allowed value */
  max?: number
  /** Step for increment (used as hint, not enforced on typing) */
  step?: number
  /** Allow decimal input (uses inputMode="decimal") */
  allowDecimal?: boolean
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, value, onValueChange, min, max, step, allowDecimal = false, onBlur, onFocus, ...props }, ref) => {
    const [display, setDisplay] = useState(() => formatValue(value))
    const [isFocused, setIsFocused] = useState(false)
    const lastExternalValue = useRef(value)

    // Sync display when external value changes (but not while focused)
    useEffect(() => {
      if (!isFocused && value !== lastExternalValue.current) {
        setDisplay(formatValue(value))
        lastExternalValue.current = value
      }
    }, [value, isFocused])

    function formatValue(v: number): string {
      if (v === 0) return '0'
      if (allowDecimal) {
        // Remove unnecessary trailing zeros but keep one decimal if relevant
        return String(v)
      }
      return String(Math.round(v))
    }

    function clamp(v: number): number {
      let result = v
      if (min !== undefined && result < min) result = min
      if (max !== undefined && result > max) result = max
      return result
    }

    function parseAndClamp(raw: string): number {
      const trimmed = raw.trim()
      if (trimmed === '' || trimmed === '-') return clamp(min ?? 0)
      const parsed = allowDecimal ? parseFloat(trimmed) : parseInt(trimmed, 10)
      if (isNaN(parsed)) return clamp(min ?? 0)
      return clamp(parsed)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value

      // Allow empty string while typing
      if (raw === '') {
        setDisplay('')
        return
      }

      // Allow minus sign alone while typing
      if (raw === '-') {
        setDisplay('-')
        return
      }

      // For decimal input, allow partial states like "5." or "12.0"
      if (allowDecimal) {
        if (/^-?\d*\.?\d*$/.test(raw)) {
          setDisplay(raw)
          // Also update the numeric value in real time for responsiveness
          const parsed = parseFloat(raw)
          if (!isNaN(parsed)) {
            const clamped = clamp(parsed)
            onValueChange(clamped)
            lastExternalValue.current = clamped
          }
        }
        return
      }

      // For integer input, only allow digits (and optional leading minus)
      if (/^-?\d*$/.test(raw)) {
        // Strip leading zeros: "01" → "1", "007" → "7"
        const cleaned = raw.replace(/^(-?)0+(\d)/, '$1$2')
        setDisplay(cleaned)
        const parsed = parseInt(cleaned, 10)
        if (!isNaN(parsed)) {
          const clamped = clamp(parsed)
          onValueChange(clamped)
          lastExternalValue.current = clamped
        }
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      const finalValue = parseAndClamp(display)
      setDisplay(formatValue(finalValue))
      onValueChange(finalValue)
      lastExternalValue.current = finalValue
      onBlur?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      // Select all text on focus for easier editing
      e.target.select()
      onFocus?.(e)
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        className={cn(
          'flex h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 text-center placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          className,
        )}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        {...props}
      />
    )
  },
)
NumericInput.displayName = 'NumericInput'
