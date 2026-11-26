import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-cream-100 text-ink-soft ring-line',
  success: 'bg-success-bg text-success ring-success/20',
  warning: 'bg-warning-bg text-warning ring-warning/20',
  danger: 'bg-danger-bg text-danger ring-danger/20',
  brand: 'bg-[color-mix(in_srgb,var(--brand)_12%,white)] text-[var(--brand)] ring-[color-mix(in_srgb,var(--brand)_25%,white)]',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
