import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: 'default' | 'quiet' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

const pad = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' } as const;

export function Card({ className, children, variant = 'default', padding = 'md', ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-app-lg)] shadow-card transition-[box-shadow,border-color] duration-300',
        pad[padding],
        variant === 'default' &&
          'border border-slate-200/90 bg-surface-1/90 shadow-inner-glow backdrop-blur-xl hover:border-slate-300/90 hover:shadow-card-hover',
        variant === 'quiet' && 'border border-slate-200/70 bg-surface-0/80 backdrop-blur-md',
        variant === 'accent' &&
          'border border-accent/25 bg-gradient-to-br from-accent/[0.08] to-surface-1/95 shadow-inner-glow',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mb-5', className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h3
      className={cn(
        'font-display text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500',
        className,
      )}
    >
      {children}
    </h3>
  );
}
