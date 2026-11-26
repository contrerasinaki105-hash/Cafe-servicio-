import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonClasses } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Registro de actividad' };

const ACTIONS: Record<string, string> = {
  'business.created': 'Negocio creado',
  'business.updated': 'Configuración del negocio actualizada',
  'staff.added': 'Acceso de personal otorgado',
  'staff.updated': 'Acceso de personal modificado',
  'customer.self_registered': 'Cliente se registró con QR',
  'customer.created_by_staff': 'Cliente registrado en mostrador',
  'customer.updated': 'Cliente actualizado',
  'customer.password_reset': 'Contraseña de cliente restablecida',
  'customer.opt_in': 'Cliente aceptó promociones',
  'customer.opt_out': 'Cliente rechazó promociones',
  'visit.registered': 'Compra registrada',
  'stamps.corrected': 'Corrección de sellos',
  'reward.redeemed': 'Recompensa canjeada',
  'reward.created': 'Recompensa creada',
  'reward.updated': 'Recompensa actualizada',
  'reward.deleted': 'Recompensa eliminada',
  'reward.deactivated': 'Recompensa desactivada',
  'program.updated': 'Programa de sellos modificado',
  'promotion.created': 'Promoción creada',
  'promotion.updated': 'Promoción actualizada',
  'promotion.sent': 'Campaña enviada',
};
const PAGE = 40;

function summarize(details: Record<string, unknown>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(details ?? {})) {
    if (v === null || v === undefined || k.endsWith('_id') || k === 'user_id' || k === 'owner') continue;
    parts.push(`${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join(' · ');
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ accion?: string; pagina?: string }> }) {
  const ctx = await requireStaff(['owner']);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const supabase = await createClient();
  let q = supabase.from('audit_logs').select('id, action, entity, details, actor_id, created_at', { count: 'exact' }).eq('business_id', ctx.business.id);
  if (sp.accion && sp.accion in ACTIONS) q = q.eq('action', sp.accion);
  const { data, count, error } = await q.order('id', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (error) throw error;

  const actorIds = [...new Set((data ?? []).map((d) => d.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id, full_name, email').in('id', actorIds) : { data: [] };
  const who = (id: string | null) => {
    if (!id) return 'Sistema';
    const a = (actors ?? []).find((x) => x.id === id);
    return a?.full_name || a?.email || 'Cliente';
  };
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (p: number) => `/admin/auditoria?${new URLSearchParams({ ...(sp.accion ? { accion: sp.accion } : {}), pagina: String(p) })}`;

  return (
    <>
      <PageHeader title="Registro de actividad" description="Historial inmutable de operaciones administrativas. Solo visible para el administrador principal." />
      <form method="get" className="mb-4 flex gap-2">
        <select name="accion" defaultValue={sp.accion ?? ''} className="h-10 rounded-xl border border-line-strong bg-surface px-3 text-sm" aria-label="Filtrar por acción">
          <option value="">Todas las acciones</option>
          {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className={buttonClasses('secondary')}>Filtrar</button>
      </form>
      <Card>
        {!data?.length ? (
          <EmptyState icon={ScrollText} title="Sin actividad" />
        ) : (
          <ul className="divide-y divide-line">
            {data.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="tabular w-40 shrink-0 text-xs text-ink-muted sm:pt-0.5">{formatDate(d.created_at, ctx.business.timezone, true)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><span className="font-medium">{ACTIONS[d.action] ?? d.action}</span> <span className="text-ink-muted">por {who(d.actor_id)}</span></p>
                  {summarize(d.details as Record<string, unknown>) && <p className="mt-0.5 break-words text-xs text-ink-muted">{summarize(d.details as Record<string, unknown>)}</p>}
                </div>
              </li>
            ))}
          </ul>
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
    </>
  );
}
