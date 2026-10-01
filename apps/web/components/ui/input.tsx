import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full px-3 py-2 rounded-[var(--radius)] text-sm bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] placeholder-[var(--text-subtle)] transition-colors',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
