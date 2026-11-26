import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, Gift, Stamp, TicketCheck, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { HourChart, TrendChart } from '@/components/admin/charts';
import { formatMoney, formatNumber } from '@/lib/utils';
import type { DashboardStats } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denegado?: string; password?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  if (ctx.role === 'employee') redirect('/admin/compra');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_dashboard_stats', { p_business: ctx.business.id, p_months: 6 });
  if (error) throw error;
  const s = data as DashboardStats;
  const inactive = s.total_customers - s.active_customers;

  return (
    <>
      {sp.denegado && (
        <div role="alert" className="mb-5 rounded-xl border border-warning/20 bg-warning-bg px-4 py-3 text-sm text-warning">
          Tu rol no tiene acceso a esa sección.
        </div>
      )}
      {sp.password && (
        <div role="status" className="mb-5 rounded-xl border border-success/20 bg-success-bg px-4 py-3 text-sm text-success">
          Tu contraseña se actualizó correctamente.
        </div>
      )}
      <PageHeader
        title={`Hola${ctx.fullName ? `, ${ctx.fullName.split(' ')[0]}` : ''}`}
        description={`Resumen de ${ctx.business.name}. Datos en tiempo real · zona horaria ${s.timezone}.`}
        actions={<Link href="/admin/compra" className={buttonClasses('brand')}>Registrar compra</Link>}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Indicadores principales">
        <StatCard label="Clientes registrados" value={s.total_customers} icon={Users} hint="Total histórico" />
        <StatCard
          label="Clientes nuevos del mes"
          value={s.new_customers_month}
          icon={UserPlus}
          trend={{ current: s.new_customers_month, previous: s.new_customers_prev_month, label: 'vs. mes anterior' }}
          hint={`${s.new_customers_prev_month} el mes anterior`}
        />
        <StatCard
          label="Visitas registradas"
          value={s.total_visits}
          icon={Activity}
          trend={{ current: s.visits_month, previous: s.visits_prev_month, label: 'este mes vs. anterior' }}
          hint={`${formatNumber(s.visits_month)} este mes`}
        />
        <StatCard label="Sellos entregados" value={s.total_stamps} icon={Stamp} hint="Compras y bonificaciones" />
        <StatCard label="Recompensas disponibles" value={s.available_rewards} icon={Gift} hint="Pendientes de canjear" />
        <StatCard label="Recompensas canjeadas" value={s.redeemed_rewards} icon={TicketCheck} hint="Total histórico" />
        <StatCard label="Clientes activos" value={s.active_customers} icon={UserCheck} hint={`Visitaron en ${s.inactive_after_days} días`} />
        <StatCard label="Clientes inactivos" value={inactive} icon={UserMinus} hint={`Sin visitas en ${s.inactive_after_days} días`} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Clientes registrados por mes" description="Altas de los últimos 6 meses" />
          <CardBody><TrendChart data={s.customers_by_month} kind="area" unit="clientes" /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Visitas por semana" description="Últimas 12 semanas" />
          <CardBody><TrendChart data={s.visits_by_week} kind="bar" unit="visitas" granularity="week" /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Sellos entregados por mes" />
          <CardBody><TrendChart data={s.stamps_by_month} kind="bar" unit="sellos" /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Recompensas canjeadas por mes" />
          <CardBody><TrendChart data={s.redemptions_by_month} kind="bar" unit="canjes" /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Horarios con mayor actividad" description="Visitas por hora · últimos 90 días" />
          <CardBody><HourChart data={s.activity_by_hour} /></CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Clientes más frecuentes"
            description="Por número de visitas"
            action={<Link href="/admin/analisis" className="text-[13px] font-medium text-coffee-600 hover:underline">Ver análisis</Link>}
          />
          {s.top_customers.length === 0 ? (
            <CardBody><p className="py-16 text-center text-sm text-ink-muted">Cuando registres compras, aquí verás a tus mejores clientes.</p></CardBody>
          ) : (
            <ol className="divide-y divide-line">
              {s.top_customers.map((c, i) => (
                <li key={c.id}>
                  <Link href={`/admin/clientes/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-cream-50">
                    <span className="tabular grid size-7 place-items-center rounded-full bg-cream-100 text-xs font-semibold text-coffee-600">{i + 1}</span>
                    <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className="tabular text-sm text-ink-soft">{c.visits} visitas</span>
                    <span className="tabular hidden w-24 text-right text-sm text-ink-muted sm:block">{formatMoney(c.spent, ctx.business.currency)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </section>
      <p className="mt-6 text-xs text-ink-muted">
        Ingresos registrados este mes: <span className="tabular font-medium text-ink-soft">{formatMoney(s.revenue_month, ctx.business.currency)}</span> (solo compras con importe capturado).
      </p>
    </>
  );
}
