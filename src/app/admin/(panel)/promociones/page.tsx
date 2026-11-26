import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import type { CustomerInsights, Promotion } from '@/lib/types';
import { PromotionManager } from './promotion-manager';

export const metadata: Metadata = { title: 'Promociones' };

export default async function PromotionsPage() {
  const ctx = await requireStaff(['owner', 'manager']);
  const supabase = await createClient();
  const [{ data: promotions }, { data: insights }, { count: total }, { count: optIn }] = await Promise.all([
    supabase.from('promotions').select('*').eq('business_id', ctx.business.id).order('created_at', { ascending: false }),
    supabase.rpc('get_customer_insights', { p_business: ctx.business.id, p_period_days: null, p_min_visits: 3, p_limit: 1 }),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', ctx.business.id).eq('status', 'active'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', ctx.business.id).eq('status', 'active').eq('marketing_opt_in', true),
  ]);
  const counts = { all: total ?? 0, ...((insights as CustomerInsights | null)?.counts ?? {}) };
  return (
    <>
      <PageHeader
        title="Promociones"
        description={`${optIn ?? 0} de ${total ?? 0} clientes aceptan recibir promociones. Las comunicaciones respetan siempre su consentimiento.`}
      />
      <PromotionManager promotions={(promotions ?? []) as Promotion[]} timezone={ctx.business.timezone} segmentCounts={counts} />
    </>
  );
}
