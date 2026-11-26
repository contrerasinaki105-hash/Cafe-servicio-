'use client';
import { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';
import { RemoteImage } from '@/components/ui/remote-image';
import { cn, initials } from '@/lib/utils';

interface Props {
  businessName: string;
  logoUrl: string | null;
  programName: string;
  customerName: string;
  balance: number;
  required: number;
  cardId: string;
}

/** Tarjeta digital con animación de sellos nuevos desde la última visita. */
export function LoyaltyCard({ businessName, logoUrl, programName, customerName, balance, required, cardId }: Props) {
  const [prev, setPrev] = useState<number | null>(null);
  useEffect(() => {
    const key = `webya-card-${cardId}`;
    let last: number | null = null;
    try {
      const raw = localStorage.getItem(key);
      last = raw === null ? null : Number(raw);
      localStorage.setItem(key, String(balance));
    } catch {
      last = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrev(last);
  }, [balance, cardId]);

  const filled = Math.min(balance, required);
  const extra = Math.max(balance - required, 0);
  const cols = required <= 10 ? 5 : required <= 12 ? 6 : required <= 20 ? 5 : 6;

  return (
    <div className="relative overflow-hidden rounded-[28px] p-6 shadow-pop animate-rise" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-[0.12]" style={{ background: 'var(--brand-accent)' }} />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full opacity-[0.08]" style={{ background: 'var(--brand-contrast)' }} />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <span className="relative size-10 shrink-0 overflow-hidden rounded-xl"><RemoteImage src={logoUrl} alt="" fill className="object-cover" /></span>
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold" style={{ background: 'var(--brand-accent)', color: 'var(--brand)' }}>{initials(businessName)}</span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{businessName}</p>
            <p className="truncate text-xs opacity-75">{programName}</p>
          </div>
        </div>
        <p className="tabular shrink-0 text-right">
          <span className="text-3xl font-semibold">{balance}</span>
          <span className="text-sm opacity-70">/{required}</span>
        </p>
      </div>

      <div className="relative mt-6 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="img" aria-label={`${filled} de ${required} sellos`}>
        {Array.from({ length: required }).map((_, i) => {
          const on = i < filled;
          const isNew = on && prev !== null && i >= prev;
          return (
            <span
              key={i}
              className={cn('grid aspect-square place-items-center rounded-full border-2 transition-colors', !on && 'border-current/25')}
              style={on ? { background: 'var(--brand-accent)', borderColor: 'transparent' } : undefined}
            >
              {on && (
                <Coffee
                  className={cn('size-[45%]', isNew && 'animate-stamp')}
                  style={{ color: 'var(--brand)', animationDelay: isNew ? `${(i - (prev ?? 0)) * 140 + 250}ms` : undefined }}
                  aria-hidden
                />
              )}
            </span>
          );
        })}
      </div>

      <div className="relative mt-5 flex items-center justify-between text-sm">
        <span className="truncate opacity-85">{customerName}</span>
        {extra > 0 ? <span className="rounded-full bg-black/15 px-2.5 py-0.5 text-xs font-medium">+{extra} acumulados</span>
          : <span className="text-xs opacity-75">{required - filled === 0 ? '¡Tarjeta completa!' : `Faltan ${required - filled}`}</span>}
      </div>
    </div>
  );
}
