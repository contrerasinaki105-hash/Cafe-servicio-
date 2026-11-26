'use client';
import { useState } from 'react';
import { QrCode, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StaffRole } from '@/lib/types';
import { Counter } from './counter';
import { QrClaimPanel } from './qr-claim-panel';

interface Props { role: StaffRole; maxStamps: number; stampsRequired: number; currency: string; timezone: string; initialCustomerId?: string; autoScan?: boolean }

export function PurchaseModes(props: Props) {
  const [mode, setMode] = useState<'qr' | 'search'>(props.initialCustomerId || props.autoScan ? 'search' : 'qr');
  const limit = props.role === 'employee' ? props.maxStamps : 20;
  return (
    <>
      <div className="mb-5 inline-grid grid-cols-2 gap-1 rounded-xl bg-cream-100 p-1" role="tablist">
        {([['qr', 'Cliente escanea QR', QrCode], ['search', 'Buscar cliente', Search]] as const).map(([m, label, Icon]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={cn('inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors', mode === m ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink')}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {mode === 'qr' ? <div className="max-w-3xl"><QrClaimPanel limit={limit} currency={props.currency} /></div> : <Counter {...props} />}
    </>
  );
}
