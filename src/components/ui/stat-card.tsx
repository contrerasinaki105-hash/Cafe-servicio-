import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  format = 'number',
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  trend?: { current: number; previous: number; label: string } | null;
  format?: 'number' | 'raw';
}) {
  let delta: number | null = null;
  if (trend && trend.previous > 0) delta = Math.round(((trend.current - trend.previous) / trend.previous) * 100);
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card animate-rise">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <Icon className="size-4 text-coffee-500" aria-hidden />
      </div>
      <p className="tabular mt-2 text-[28px] font-semibold leading-none tracking-tight text-ink">
        {format === 'number' ? formatNumber(value) : value}
      </p>
      <div className="mt-2 flex min-h-5 items-center gap-1.5 text-xs text-ink-muted">
        {delta !== null && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', delta >= 0 ? 'text-success' : 'text-danger')}>
            {delta >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
        {delta !== null && trend ? <span>{trend.label}</span> : hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}
