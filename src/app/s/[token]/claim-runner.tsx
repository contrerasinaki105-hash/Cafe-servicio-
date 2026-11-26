'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Coffee, Gift, Loader2 } from 'lucide-react';
import { claimStamps } from '@/server/customer-actions';
import { buttonClasses } from '@/components/ui/button';

type Result = { stamps: number; stamp_balance: number; new_rewards: number; duplicate: boolean };

export function ClaimRunner({ token, slug, required }: { token: string; slug: string; required: number }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    claimStamps(token).then((res) => {
      if (res.ok && res.data) setResult(res.data);
      else setError(res.ok ? 'No pudimos registrar el sello.' : res.error);
    });
  }, [token]);

  if (error)
    return (
      <div className="text-center animate-rise">
        <AlertCircle className="mx-auto size-12 text-danger" />
        <p className="mt-4 text-lg font-semibold">No se pudo sumar el sello</p>
        <p className="mt-1 text-sm text-ink-muted">{error}</p>
        <Link href={`/c/${slug}/tarjeta`} className={buttonClasses('secondary', 'lg', 'mt-6 w-full')}>Ver mi tarjeta</Link>
      </div>
    );

  if (!result)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-ink-muted" role="status">
        <Loader2 className="size-8 animate-spin" /> Registrando tu sello…
      </div>
    );

  const filled = Math.min(result.stamp_balance, required);
  return (
    <div className="text-center">
      <div className="mx-auto grid size-24 place-items-center rounded-full animate-stamp" style={{ background: 'var(--brand-accent)' }}>
        <Coffee className="size-11" style={{ color: 'var(--brand)' }} />
      </div>
      <p className="mt-6 text-2xl font-semibold tracking-tight">{result.duplicate ? 'Este sello ya estaba en tu tarjeta' : `¡+${result.stamps} ${result.stamps === 1 ? 'sello' : 'sellos'}!`}</p>
      <p className="tabular mt-1 text-ink-muted">Llevas {result.stamp_balance} de {required}</p>
      <div className="mx-auto mt-5 grid max-w-xs grid-cols-5 gap-2" aria-hidden>
        {Array.from({ length: required }).map((_, i) => (
          <span key={i} className="aspect-square rounded-full border-2" style={i < filled ? { background: 'var(--brand)', borderColor: 'transparent' } : { borderColor: '#e2d4bd' }} />
        ))}
      </div>
      {result.new_rewards > 0 && (
        <p className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-success-bg px-4 py-3 text-sm font-medium text-success animate-rise">
          <Gift className="size-4" /> ¡Desbloqueaste una recompensa!
        </p>
      )}
      <Link href={`/c/${slug}/tarjeta`} className={buttonClasses('brand', 'lg', 'mt-8 w-full')}>Ver mi tarjeta</Link>
    </div>
  );
}
