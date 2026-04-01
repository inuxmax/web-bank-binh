import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({
  className,
  children,
  variant = 'primary',
  size = 'md',
  ...rest
}: ButtonProps) {
  const sizes = {
    sm: 'h-9 px-3.5 text-sm rounded-[var(--radius-app)]',
    md: 'h-11 px-5 text-[0.9375rem] rounded-[var(--radius-app)]',
    lg: 'h-12 px-6 text-base rounded-[var(--radius-app-lg)]',
  } as const;

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition duration-200 disabled:pointer-events-none disabled:opacity-45',
        sizes[size],
        variant === 'primary' &&
          'bg-accent text-on-accent shadow-glow hover:brightness-[1.03] active:brightness-[0.97]',
        variant === 'secondary' &&
          'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
