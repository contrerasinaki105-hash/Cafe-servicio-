import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { formatDate, requestTime } from '@/lib/utils';
import type { Reward } from '@/lib/types';
import { RewardManager } from './reward-manager';

export const metadata: Metadata = { title: 'Recompensas' };

export default async function RewardsPage() {
  const ctx = await requireStaff(['owner', 'manager']);
  const supabase = await createClient();
  const bid = ctx.business.id;
  const [{ data: rewards }, { data: counts }, { data: program }, { data: recent }] = await Promise.all([
    supabase.from('rewards').select('*').eq('business_id', bid).order('is_active', { ascending: false }).order('stamps_required'),
    supabase.from('reward_redemptions').select('reward_id, status').eq('business_id', bid).in('status', ['available', 'redeemed']),
    supabase.from('loyalty_programs').select('base_reward_id').eq('business_id', bid).eq('is_active', true).maybeSingle(),
    supabase
      .from('reward_redemptions')
      .select('id, redeemed_at, code, rewards(name), customers(first_name, last_name)')
      .eq('business_id', bid)
      .eq('status', 'redeemed')
      .order('redeemed_at', { ascending: false })
      .limit(10),
  ]);

  const withStats = ((rewards ?? []) as Reward[]).map((r) => ({
    ...r,
    redeemed: (counts ?? []).filter((c) => c.reward_id === r.id && c.status === 'redeemed').length,
    available: (counts ?? []).filter((c) => c.reward_id === r.id && c.status === 'available').length,
    isBase: program?.base_reward_id === r.id,
  }));
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);

  return (
    <>
      <PageHeader title="Recompensas" description="Cuando un cliente alcanza los sellos, la recompensa se genera automáticamente y el personal confirma el canje." />
      <RewardManager rewards={withStats} canEdit={ctx.role === 'owner'} timezone={ctx.business.timezone} now={requestTime()} />
      <Card className="mt-6">
        <CardHeader title="Últimos canjes" />
        {!recent?.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">Aún no hay canjes.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => {
              const rw = one(r.rewards as { name: string } | { name: string }[] | null);
              const c = one(r.customers as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate"><span className="font-medium">{rw?.name}</span> · {c ? `${c.first_name} ${c.last_name}` : '—'}</span>
                  <span className="shrink-0 text-ink-muted">{formatDate(r.redeemed_at, ctx.business.timezone, true)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
