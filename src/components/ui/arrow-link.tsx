import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function ArrowLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'group inline-flex items-center gap-1.5 text-sm font-medium text-accent transition hover:gap-2.5',
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
