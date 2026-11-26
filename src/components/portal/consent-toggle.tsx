'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setMarketingConsent } from '@/server/customer-actions';

export function ConsentToggle({ slug, businessId, initial }: { slug: string; businessId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">Recibir promociones</span>
        <span className="block text-xs text-ink-muted">Avisos de descuentos y beneficios. Puedes cambiarlo cuando quieras.</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const next = !on;
            const res = await setMarketingConsent(slug, businessId, next);
            if (res.ok) {
              setOn(next);
              toast.success(res.message);
            } else toast.error(res.error);
          })
        }
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--brand)]' : 'bg-cream-300'} disabled:opacity-60`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}
