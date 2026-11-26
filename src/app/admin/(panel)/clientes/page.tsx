import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/field';
import { Button, buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { NewCustomerButton } from '@/components/admin/new-customer-button';
import { cn, formatDate, formatNumber, formatRelative, requestTime } from '@/lib/utils';
import { formatPhone } from '@/lib/phone';
import type { CustomerOverview } from '@/lib/types';

export const metadata: Metadata = { title: 'Clientes' };

const PAGE_SIZE = 25;
const SORTS = {
  recent: { column: 'created_at', label: 'Fecha de registro' },
  visits: { column: 'visits_count', label: 'Visitas' },
  stamps: { column: 'stamp_balance', label: 'Sellos' },
  last_visit: { column: 'last_visit_at', label: 'Última visita' },
  spent: { column: 'total_spent', label: 'Gasto' },
} as const;
type SortKey = keyof typeof SORTS;

interface SP { q?: string; estado?: string; actividad?: string; orden?: string; pagina?: string }

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const sort: SortKey = (sp.orden as SortKey) in SORTS ? (sp.orden as SortKey) : 'recent';
  const page = Math.max(1, Number(sp.pagina) || 1);
  const days = ctx.business.inactive_after_days;
  const cutoff = new Date(requestTime() - days * 86400000).toISOString();

  const supabase = await createClient();
  let query = supabase.from('customer_overview').select('*', { count: 'exact' }).eq('business_id', ctx.business.id);
  if (q) {
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 4) query = query.ilike('phone', `%${digits.slice(-10)}%`);
    else
      for (const term of q.replace(/[%_,()]/g, ' ').split(/\s+/).filter(Boolean))
        query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  if (sp.estado === 'active' || sp.estado === 'blocked') query = query.eq('status', sp.estado);
  if (sp.actividad === 'activos') query = query.gte('last_visit_at', cutoff);
  if (sp.actividad === 'inactivos') query = query.or(`last_visit_at.lt.${cutoff},last_visit_at.is.null`);
  if (sp.actividad === 'con_premio') query = query.gt('available_rewards', 0);

  const { data, count, error } = await query
    .order(SORTS[sort].column, { ascending: false, nullsFirst: false })
    .order('id')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;
  const rows = (data ?? []) as CustomerOverview[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/admin/clientes?${p.toString()}`;
  };
  const filtered = Boolean(q || sp.estado || sp.actividad);

  return (
    <>
      <PageHeader title="Clientes" description={`${formatNumber(total)} ${filtered ? 'resultados' : 'clientes registrados'}`} actions={<NewCustomerButton />} />

      <Card>
        <form method="get" className="flex flex-col gap-2 border-b border-line p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono o correo" className="pl-10" aria-label="Buscar clientes" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Select name="actividad" defaultValue={sp.actividad ?? ''} aria-label="Filtrar por actividad" className="md:w-44">
              <option value="">Toda actividad</option>
              <option value="activos">Activos ({days} días)</option>
              <option value="inactivos">Inactivos ({days} días)</option>
              <option value="con_premio">Con recompensa</option>
            </Select>
            <Select name="estado" defaultValue={sp.estado ?? ''} aria-label="Filtrar por estado" className="md:w-36">
              <option value="">Todo estado</option>
              <option value="active">Activos</option>
              <option value="blocked">Bloqueados</option>
            </Select>
            <Select name="orden" defaultValue={sort} aria-label="Ordenar" className="md:w-48">
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Ordenar: {v.label}</option>)}
            </Select>
            <Button type="submit" variant="secondary">Aplicar</Button>
          </div>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered ? 'Sin resultados' : 'Aún no hay clientes'}
            description={filtered ? 'Prueba con otros filtros o términos de búsqueda.' : 'Comparte el QR de registro en tu mostrador o registra clientes desde «Registrar compra».'}
            action={filtered ? <Link href="/admin/clientes" className={buttonClasses('secondary', 'sm')}>Limpiar filtros</Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-ink-muted">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Teléfono</th>
                  <SortTh label="Registro" active={sort === 'recent'} href={href({ orden: 'recent', pagina: undefined })} />
                  <SortTh label="Visitas" active={sort === 'visits'} href={href({ orden: 'visits', pagina: undefined })} align="right" />
                  <SortTh label="Sellos" active={sort === 'stamps'} href={href({ orden: 'stamps', pagina: undefined })} align="right" />
                  <th className="px-3 py-3 text-right font-medium">Premios</th>
                  <SortTh label="Última visita" active={sort === 'last_visit'} href={href({ orden: 'last_visit', pagina: undefined })} />
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => {
                  const inactive = !c.last_visit_at || c.last_visit_at < cutoff;
                  return (
                    <tr key={c.id} className="group hover:bg-cream-50">
                      <td className="px-5 py-3">
                        <Link href={`/admin/clientes/${c.id}`} className="block font-medium text-ink group-hover:text-[var(--brand)]">{c.full_name}</Link>
                        <span className="block max-w-[220px] truncate text-xs text-ink-muted">{c.email ?? 'Sin correo'}</span>
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-ink-soft">{formatPhone(c.phone)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-soft">{formatDate(c.created_at, ctx.business.timezone)}</td>
                      <td className="tabular px-3 py-3 text-right">{c.visits_count}</td>
                      <td className="tabular px-3 py-3 text-right">{c.stamp_balance}</td>
                      <td className="tabular px-3 py-3 text-right">{c.available_rewards > 0 ? <Badge tone="success">{c.available_rewards}</Badge> : <span className="text-ink-muted">0</span>}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-soft">{formatRelative(c.last_visit_at)}</td>
                      <td className="px-5 py-3">
                        {c.status === 'blocked' ? <Badge tone="danger">Bloqueado</Badge> : inactive ? <Badge tone="warning">Inactivo</Badge> : <Badge tone="success" dot>Activo</Badge>}
                      </td>
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
              <Link aria-disabled={page <= 1} className={cn(buttonClasses('secondary', 'sm'), page <= 1 && 'pointer-events-none opacity-50')} href={href({ pagina: String(page - 1) })}>
                <ChevronLeft className="size-4" /> Anterior
              </Link>
              <Link aria-disabled={page >= pages} className={cn(buttonClasses('secondary', 'sm'), page >= pages && 'pointer-events-none opacity-50')} href={href({ pagina: String(page + 1) })}>
                Siguiente <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-muted">Un cliente se considera inactivo si no ha visitado en {days} días (configurable en Configuración).</p>
    </>
  );
}

function SortTh({ label, active, href, align }: { label: string; active: boolean; href: string; align?: 'right' }) {
  return (
    <th className={cn('px-3 py-3 font-medium', align === 'right' && 'text-right')} aria-sort={active ? 'descending' : undefined}>
      <Link href={href} className={cn('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}>
        {label} {active && <ArrowDown className="size-3" aria-hidden />}
      </Link>
    </th>
  );
}
