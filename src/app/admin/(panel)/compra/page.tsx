import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import type { LoyaltyProgram } from '@/lib/types';
import { PurchaseModes } from './purchase-modes';

export const metadata: Metadata = { title: 'Registrar compra' };

export default async function PurchasePage({ searchParams }: { searchParams: Promise<{ cliente?: string; escanear?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const initialCustomerId = sp.cliente && /^[0-9a-f-]{36}$/i.test(sp.cliente) ? sp.cliente : undefined;
  const supabase = await createClient();
  const { data: program } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('business_id', ctx.business.id)
    .eq('is_active', true)
    .maybeSingle<LoyaltyProgram>();

  return (
    <>
      <PageHeader title="Registrar compra" description={program ? `${program.stamps_required} sellos = ${program.reward_description}` : undefined} />
      {program ? (
        <PurchaseModes
          role={ctx.role}
          maxStamps={program.max_stamps_per_visit}
          stampsRequired={program.stamps_required}
          currency={ctx.business.currency}
          timezone={ctx.business.timezone}
          initialCustomerId={initialCustomerId}
          autoScan={sp.escanear === '1'}
        />
      ) : (
        <p className="text-sm text-ink-muted">El negocio no tiene un programa de fidelización activo.</p>
      )}
    </>
  );
}
