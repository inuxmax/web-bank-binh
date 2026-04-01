import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function FieldLabel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <label className={cn('block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500', className)}>
      {children}
    </label>
  );
}

export const fieldInputClass = cn(
  'mt-2 w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900',
  'placeholder:text-slate-400 shadow-sm transition focus:border-accent/50 focus:ring-1 focus:ring-accent/25',
);

export const fieldSelectClass = fieldInputClass;
