import type { Metadata } from 'next';
import { CalendarDays, Gift } from 'lucide-react';
import { requireCustomer } from '@/lib/auth/require-customer';
import { createClient } from '@/lib/supabase/server';
import { PortalHeader } from '@/components/portal/portal-header';
import { BottomNav } from '@/components/portal/bottom-nav';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Historial' };

const REASONS: Record<string, string> = { purchase: 'Compra', correction: 'Ajuste del establecimiento', redemption: 'Canje', bonus: 'Regalo', promotion: 'Promoción' };

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, customer } = await requireCustomer(slug);
  const supabase = await createClient();
  const [{ data: stamps }, { data: redeemed }, { count: visits }] = await Promise.all([
    supabase.from('stamps').select('id, delta, reason, created_at, balance_after').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(60),
    supabase.from('reward_redemptions').select('id, redeemed_at, code, rewards(name)').eq('customer_id', customer.id).eq('status', 'redeemed').order('redeemed_at', { ascending: false }).limit(30),
    supabase.from('visits').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id),
  ]);

  return (
    <>
      <PortalHeader business={business} />
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card"><CalendarDays className="size-4 text-[var(--brand)]" /><p className="tabular mt-2 text-2xl font-semibold">{visits ?? 0}</p><p className="text-xs text-ink-muted">Visitas</p></div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card"><Gift className="size-4 text-[var(--brand)]" /><p className="tabular mt-2 text-2xl font-semibold">{redeemed?.length ?? 0}</p><p className="text-xs text-ink-muted">Recompensas canjeadas</p></div>
        </div>

        <h2 className="mt-8 text-sm font-semibold">Recompensas canjeadas</h2>
        {!redeemed?.length ? <p className="mt-2 text-sm text-ink-muted">Todavía no has canjeado recompensas.</p> : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {redeemed.map((r) => {
              const rw = (Array.isArray(r.rewards) ? r.rewards[0] : r.rewards) as { name: string } | null;
              return (
                <li key={r.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{rw?.name}</span>
                  <span className="text-ink-muted">{formatDate(r.redeemed_at)}</span>
                </li>
              );
            })}
          </ul>
        )}

        <h2 className="mt-8 text-sm font-semibold">Movimientos de sellos</h2>
        {!stamps?.length ? <p className="mt-2 text-sm text-ink-muted">Aún no tienes sellos. ¡Tu primera compra suma!</p> : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {stamps.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{REASONS[s.reason] ?? s.reason}</p>
                  <p className="text-xs text-ink-muted">{formatDate(s.created_at, undefined, true)}</p>
                </div>
                <span className={`tabular font-semibold ${s.delta > 0 ? 'text-success' : 'text-ink-soft'}`}>{s.delta > 0 ? '+' : ''}{s.delta}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav slug={slug} />
    </>
  );
}
