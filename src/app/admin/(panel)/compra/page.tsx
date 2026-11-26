import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import type { LoyaltyProgram } from '@/lib/types';
import { Counter } from './counter';

export const metadata: Metadata = { title: 'Registrar compra' };

export default async function PurchasePage() {
  const ctx = await requireStaff();
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
        <Counter
          role={ctx.role}
          maxStamps={program.max_stamps_per_visit}
          stampsRequired={program.stamps_required}
          currency={ctx.business.currency}
          timezone={ctx.business.timezone}
        />
      ) : (
        <p className="text-sm text-ink-muted">El negocio no tiene un programa de fidelización activo.</p>
      )}
    </>
  );
}
