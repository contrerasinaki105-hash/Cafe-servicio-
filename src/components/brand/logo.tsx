import { cn } from '@/lib/utils';

/** Marca WebYA Loyalty. */
export function WebyaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#241810" />
      <path d="M9 11.5h11.5v5.2a5.75 5.75 0 0 1-11.5 0z" fill="#C8A27C" />
      <path d="M20.5 12.6h1.4a2.6 2.6 0 0 1 0 5.2h-1.6" fill="none" stroke="#C8A27C" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14.75" cy="15.2" r="1.6" fill="#241810" />
      <path d="M10 24.2h9.5" stroke="#C8A27C" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function WebyaLogo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <WebyaMark />
      <span className={cn('text-[15px] font-semibold tracking-tight', light ? 'text-cream-50' : 'text-ink')}>
        WebYA <span className={light ? 'text-latte-400' : 'text-coffee-500'}>Loyalty</span>
      </span>
    </span>
  );
}
