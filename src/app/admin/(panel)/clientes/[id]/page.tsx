import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, Gift, Mail, Phone, Stamp, Wallet } from 'lucide-react';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { formatDate, formatMoney, formatRelative } from '@/lib/utils';
import { formatPhone } from '@/lib/phone';
import type { CustomerOverview } from '@/lib/types';
import { CustomerActions } from './actions';

export const metadata: Metadata = { title: 'Perfil de cliente' };

const REASONS: Record<string, string> = { purchase: 'Compra', correction: 'Corrección', redemption: 'Canje', bonus: 'Bonificación', promotion: 'Promoción' };
const RED_STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  available: { label: 'Disponible', tone: 'success' },
  redeemed: { label: 'Canjeada', tone: 'neutral' },
  void: { label: 'Anulada', tone: 'warning' },
  expired: { label: 'Caducada', tone: 'danger' },
};

export default async function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireStaff();
  const supabase = await createClient();
  const bid = ctx.business.id;
  const tz = ctx.business.timezone;

  const [{ data: customer }, { data: raw }, { data: ledger }, { data: visits }, { data: redemptions }] = await Promise.all([
    supabase.from('customer_overview').select('*').eq('id', id).eq('business_id', bid).maybeSingle<CustomerOverview>(),
    supabase.from('customers').select('notes, marketing_opt_in_at').eq('id', id).eq('business_id', bid).maybeSingle(),
    supabase.from('stamps').select('id, delta, balance_after, reason, note, created_by, created_at').eq('customer_id', id).eq('business_id', bid).order('created_at', { ascending: false }).limit(50),
    supabase.from('visits').select('id, created_at, stamps_awarded, amount, recorded_by, note').eq('customer_id', id).eq('business_id', bid).order('created_at', { ascending: false }).limit(50),
    supabase.from('reward_redemptions').select('id, code, status, stamps_cost, issued_at, redeemed_at, redeemed_by, rewards(name)').eq('customer_id', id).eq('business_id', bid).in('status', ['available', 'redeemed', 'expired']).order('issued_at', { ascending: false }).limit(50),
  ]);
  if (!customer) notFound();

  const staffIds = [...new Set([...(ledger ?? []).map((l) => l.created_by), ...(visits ?? []).map((v) => v.recorded_by), ...(redemptions ?? []).map((r) => r.redeemed_by)].filter(Boolean))] as string[];
  const { data: staff } = staffIds.length ? await supabase.from('profiles').select('id, full_name, email').in('id', staffIds) : { data: [] };
  const who = (uid: string | null) => {
    if (!uid) return 'Sistema';
    const p = (staff ?? []).find((s) => s.id === uid);
    return p?.full_name || p?.email || 'Personal';
  };
  const canManage = ctx.role !== 'employee';
  const rewardName = (r: { rewards: unknown }) => {
    const rw = r.rewards as { name: string } | { name: string }[] | null;
    return (Array.isArray(rw) ? rw[0]?.name : rw?.name) ?? 'Recompensa';
  };

  return (
    <>
      <Link href="/admin/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" /> Clientes</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-fade-in">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.full_name}</h1>
            {customer.status === 'blocked' ? <Badge tone="danger">Bloqueado</Badge> : <Badge tone="success" dot>Activo</Badge>}
            {customer.user_id ? <Badge tone="brand">Tarjeta digital activa</Badge> : <Badge>Sin cuenta en línea</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" />{formatPhone(customer.phone)}</span>
            <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" />{customer.email ?? 'Sin correo'}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />Cliente desde {formatDate(customer.created_at, tz)}</span>
            <span>Promociones: {customer.marketing_opt_in ? 'acepta' : 'no acepta'}</span>
          </div>
        </div>
        {canManage && <div className="flex flex-wrap gap-2"><CustomerActions customer={customer} notes={raw?.notes ?? null} /></div>}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Sellos actuales" value={customer.stamp_balance} icon={Stamp} hint={`${customer.lifetime_stamps} acumulados en total`} />
        <StatCard label="Visitas" value={customer.visits_count} icon={CalendarDays} hint={`Última: ${formatRelative(customer.last_visit_at).toLowerCase()}`} />
        <StatCard label="Gasto registrado" value={formatMoney(customer.total_spent, ctx.business.currency)} icon={Wallet} format="raw" hint="Compras con importe" />
        <StatCard label="Recompensas disponibles" value={customer.available_rewards} icon={Gift} hint="Listas para canjear" />
      </section>

      {raw?.notes && canManage && (
        <p className="mt-4 rounded-xl border border-line bg-cream-50 px-4 py-3 text-sm text-ink-soft"><span className="font-medium text-ink">Notas: </span>{raw.notes}</p>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Historial de sellos" description="Cada movimiento con responsable, fecha y hora" />
          <HistoryList
            empty="Sin movimientos todavía."
            rows={(ledger ?? []).map((l) => ({
              id: l.id,
              title: `${REASONS[l.reason] ?? l.reason}${l.note ? ` · ${l.note}` : ''}`,
              meta: `${who(l.created_by)} · ${formatDate(l.created_at, tz, true)}`,
              value: `${l.delta > 0 ? '+' : ''}${l.delta}`,
              positive: l.delta > 0,
              extra: `saldo ${l.balance_after}`,
            }))}
          />
        </Card>
        <Card>
          <CardHeader title="Recompensas" description="Disponibles y canjeadas" />
          <HistoryList
            empty="Aún no ha conseguido recompensas."
            rows={(redemptions ?? []).map((r) => ({
              id: r.id,
              title: rewardName(r),
              meta: r.status === 'redeemed' ? `Canjeada por ${who(r.redeemed_by)} · ${formatDate(r.redeemed_at, tz, true)}` : `Emitida ${formatDate(r.issued_at, tz, true)} · código ${r.code}`,
              badge: RED_STATUS[r.status],
              value: `${r.stamps_cost} sellos`,
            }))}
          />
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Visitas y compras" />
          <HistoryList
            empty="Sin visitas registradas."
            rows={(visits ?? []).map((v) => ({
              id: v.id,
              title: v.amount !== null ? formatMoney(v.amount, ctx.business.currency) : 'Compra sin importe',
              meta: `Registró ${who(v.recorded_by)} · ${formatDate(v.created_at, tz, true)}`,
              value: `+${v.stamps_awarded} ${v.stamps_awarded === 1 ? 'sello' : 'sellos'}`,
              positive: true,
            }))}
          />
        </Card>
      </div>
    </>
  );
}

function HistoryList({ rows, empty }: {
  rows: { id: string; title: string; meta: string; value: string; positive?: boolean; extra?: string; badge?: { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' } }[];
  empty: string;
}) {
  if (!rows.length) return <p className="px-5 py-10 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.title}</p>
            <p className="truncate text-xs text-ink-muted">{r.meta}</p>
          </div>
          {r.badge && <Badge tone={r.badge.tone}>{r.badge.label}</Badge>}
          <div className="text-right">
            <p className={`tabular text-sm font-semibold ${r.positive === undefined ? 'text-ink-soft' : r.positive ? 'text-success' : 'text-danger'}`}>{r.value}</p>
            {r.extra && <p className="tabular text-[11px] text-ink-muted">{r.extra}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
