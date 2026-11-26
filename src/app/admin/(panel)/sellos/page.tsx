import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Stamp } from 'lucide-react';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/field';
import { Button, buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatDate } from '@/lib/utils';
import type { LoyaltyProgram } from '@/lib/types';
import { ProgramForm } from './program-form';

export const metadata: Metadata = { title: 'Sellos' };

const REASONS = {
  purchase: { label: 'Compra', tone: 'success' },
  correction: { label: 'Corrección', tone: 'warning' },
  redemption: { label: 'Canje', tone: 'brand' },
  bonus: { label: 'Bonificación', tone: 'info' },
  promotion: { label: 'Promoción', tone: 'info' },
} as const;
const PAGE = 30;

export default async function StampsPage({ searchParams }: { searchParams: Promise<{ tipo?: string; pagina?: string }> }) {
  const ctx = await requireStaff(['owner', 'manager']);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const tipo = sp.tipo && sp.tipo in REASONS ? (sp.tipo as keyof typeof REASONS) : null;
  const supabase = await createClient();

  let ledgerQ = supabase
    .from('stamps')
    .select('id, delta, balance_after, reason, note, created_by, created_at, customer_id, visit_id, customers(first_name, last_name)', { count: 'exact' })
    .eq('business_id', ctx.business.id);
  if (tipo) ledgerQ = ledgerQ.eq('reason', tipo);

  const [{ data: program }, { data: ledger, count }] = await Promise.all([
    supabase.from('loyalty_programs').select('*').eq('business_id', ctx.business.id).eq('is_active', true).maybeSingle<LoyaltyProgram>(),
    ledgerQ.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
  ]);

  const staffIds = [...new Set((ledger ?? []).map((l) => l.created_by).filter(Boolean))] as string[];
  const { data: staff } = staffIds.length ? await supabase.from('profiles').select('id, full_name, email').in('id', staffIds) : { data: [] };
  const who = (id: string | null) => (staff ?? []).find((s) => s.id === id)?.full_name || (staff ?? []).find((s) => s.id === id)?.email || 'Sistema';
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (p: number) => `/admin/sellos?${new URLSearchParams({ ...(tipo ? { tipo } : {}), pagina: String(p) })}`;

  return (
    <>
      <PageHeader title="Sellos" description="Configuración de la tarjeta e historial completo de movimientos." />
      <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Programa de fidelización" description={program ? `${program.stamps_required} sellos = ${program.reward_description}` : undefined} />
          <CardBody>
            {program && ctx.role === 'owner' ? (
              <ProgramForm program={program} />
            ) : program ? (
              <dl className="space-y-3 text-sm">
                <Row k="Tarjeta" v={program.name} />
                <Row k="Sellos necesarios" v={String(program.stamps_required)} />
                <Row k="Recompensa" v={program.reward_description} />
                <Row k="Máx. por compra (empleados)" v={String(program.max_stamps_per_visit)} />
                <Row k="Minutos entre compras" v={String(program.cooldown_minutes)} />
                <p className="pt-2 text-xs text-ink-muted">Solo el administrador principal puede modificar el programa.</p>
              </dl>
            ) : (
              <p className="text-sm text-ink-muted">Sin programa activo.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Historial de sellos"
            description={`${count ?? 0} movimientos · quién, cuándo y por qué`}
            action={
              <form method="get" className="flex gap-2">
                <Select name="tipo" defaultValue={tipo ?? ''} className="h-9 w-40" aria-label="Filtrar por tipo">
                  <option value="">Todos</option>
                  {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
                <Button type="submit" size="sm" variant="secondary">Filtrar</Button>
              </form>
            }
          />
          {!ledger?.length ? (
            <EmptyState icon={Stamp} title="Sin movimientos" description="Los sellos aparecerán aquí en cuanto se registren compras." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th className="px-5 py-3 font-medium">Fecha y hora</th>
                    <th className="px-3 py-3 font-medium">Cliente</th>
                    <th className="px-3 py-3 font-medium">Tipo</th>
                    <th className="px-3 py-3 text-right font-medium">Sellos</th>
                    <th className="px-3 py-3 text-right font-medium">Saldo</th>
                    <th className="px-5 py-3 font-medium">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ledger.map((l) => {
                    const c = (Array.isArray(l.customers) ? l.customers[0] : l.customers) as { first_name: string; last_name: string } | null;
                    const r = REASONS[l.reason as keyof typeof REASONS];
                    return (
                      <tr key={l.id} className="hover:bg-cream-50">
                        <td className="whitespace-nowrap px-5 py-2.5 text-ink-soft">{formatDate(l.created_at, ctx.business.timezone, true)}</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/clientes/${l.customer_id}`} className="font-medium hover:text-[var(--brand)]">{c ? `${c.first_name} ${c.last_name}` : '—'}</Link>
                          {l.note && <span className="block max-w-[260px] truncate text-xs text-ink-muted">{l.note}</span>}
                        </td>
                        <td className="px-3 py-2.5"><Badge tone={r?.tone ?? 'neutral'}>{r?.label ?? l.reason}</Badge></td>
                        <td className={cn('tabular px-3 py-2.5 text-right font-semibold', l.delta > 0 ? 'text-success' : 'text-danger')}>{l.delta > 0 ? '+' : ''}{l.delta}</td>
                        <td className="tabular px-3 py-2.5 text-right text-ink-soft">{l.balance_after}</td>
                        <td className="px-5 py-2.5 text-ink-soft">{who(l.created_by)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-ink-muted">
              <span>Página {page} de {pages}</span>
              <div className="flex gap-2">
                <Link className={cn(buttonClasses('secondary', 'sm'), page <= 1 && 'pointer-events-none opacity-50')} href={qs(page - 1)}><ChevronLeft className="size-4" /></Link>
                <Link className={cn(buttonClasses('secondary', 'sm'), page >= pages && 'pointer-events-none opacity-50')} href={qs(page + 1)}><ChevronRight className="size-4" /></Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
