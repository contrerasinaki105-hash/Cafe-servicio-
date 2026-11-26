import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Gift, Sparkles, Target, TrendingUp, UserMinus } from 'lucide-react';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { formatMoney, formatRelative } from '@/lib/utils';
import type { CustomerInsights, InsightCustomer } from '@/lib/types';

export const metadata: Metadata = { title: 'Análisis de clientes' };

const PERIODS = [7, 14, 30, 60, 90, 180, 365];

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ dias?: string; visitas?: string }> }) {
  const ctx = await requireStaff(['owner', 'manager']);
  const sp = await searchParams;
  const days = Math.min(Math.max(Number(sp.dias) || ctx.business.inactive_after_days, 1), 730);
  const minVisits = Math.min(Math.max(Number(sp.visitas) || 3, 1), 50);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_customer_insights', {
    p_business: ctx.business.id,
    p_period_days: days,
    p_min_visits: minVisits,
    p_limit: 10,
  });
  if (error) throw error;
  const i = data as CustomerInsights;
  const cur = ctx.business.currency;

  return (
    <>
      <PageHeader title="Análisis de clientes" description="Segmentos calculados en el servidor sobre el periodo que elijas." />

      <form method="get" className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-end">
        <label className="flex-1 text-[13px] font-medium">
          Periodo de análisis
          <Select name="dias" defaultValue={String(days)} className="mt-1.5">
            {[...new Set([...PERIODS, days])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
          </Select>
        </label>
        <label className="flex-1 text-[13px] font-medium">
          Visitas mínimas para ser «frecuente»
          <Input name="visitas" type="number" min={1} max={50} defaultValue={minVisits} className="mt-1.5" />
        </label>
        <Button type="submit" variant="secondary">Actualizar</Button>
      </form>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Frecuentes" value={i.counts.frequent} icon={TrendingUp} hint={`≥ ${minVisits} visitas en ${days} días`} />
        <StatCard label="No han regresado" value={i.counts.inactive} icon={UserMinus} hint={`Sin visitas en ${days} días`} />
        <StatCard label="Nuevos" value={i.counts.new} icon={Sparkles} hint={`Registrados en ${days} días`} />
        <StatCard label="Con recompensa pendiente" value={i.counts.pending_reward} icon={Gift} hint="Aún sin canjear" />
        <StatCard label="Cerca de una recompensa" value={i.counts.near_reward} icon={Target} hint="Les faltan pocos sellos" />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Segment title="Clientes frecuentes" description={`Más visitas en los últimos ${days} días`} rows={i.frequent} metric={(c) => `${c.recent_visits} visitas`} />
        <Segment title="Clientes que no han regresado" description={`Su última visita fue hace más de ${days} días`} rows={i.inactive} metric={(c) => formatRelative(c.last_visit ?? c.created_at)} icon={Clock} />
        <Segment title="Clientes nuevos" rows={i.new} metric={(c) => formatRelative(c.created_at)} />
        <Segment title="Cerca de conseguir una recompensa" rows={i.near_reward} metric={(c) => `${c.balance} sellos`} />
        <Segment title="Con recompensas pendientes" rows={i.pending_reward} metric={(c) => `${c.pending_rewards} por canjear`} />
        <Segment title="Mayor cantidad de visitas" description="Histórico" rows={i.top_visits} metric={(c) => `${c.visits} visitas`} />
        <Segment title="Mayor gasto registrado" description="Histórico, compras con importe" rows={i.top_spend} metric={(c) => formatMoney(c.spent, cur)} className="lg:col-span-2" />
      </div>
    </>
  );
}

function Segment({ title, description, rows, metric, className }: { title: string; description?: string; rows: InsightCustomer[]; metric: (c: InsightCustomer) => string; icon?: unknown; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} />
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-muted">Ningún cliente en este segmento.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clientes/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-cream-50">
                <span className="min-w-0 truncate font-medium">{c.name}</span>
                <span className="tabular shrink-0 text-ink-soft">{metric(c)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
