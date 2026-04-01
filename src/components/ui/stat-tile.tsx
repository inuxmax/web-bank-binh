import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function StatTile({
  label,
  value,
  hint,
  action,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/90 p-6 shadow-card shadow-inner-glow backdrop-blur-xl',
        'transition duration-300 hover:border-slate-300 hover:shadow-card-hover',
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
      {hint ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
