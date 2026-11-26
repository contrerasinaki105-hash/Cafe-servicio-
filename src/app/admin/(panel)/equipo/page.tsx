import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { TeamManager, type TeamMember } from './team-manager';
import type { StaffRole } from '@/lib/types';

export const metadata: Metadata = { title: 'Equipo' };

const ORDER: Record<StaffRole, number> = { owner: 0, manager: 1, employee: 2 };

export default async function TeamPage() {
  const ctx = await requireStaff(['owner']);
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, is_active, created_at, profiles!memberships_user_id_fkey(email, full_name), employees(display_name, position, phone)')
    .eq('business_id', ctx.business.id);
  if (error) throw error;

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const members: TeamMember[] = (rows ?? [])
    .map((r) => {
      const p = one(r.profiles as unknown as { email: string | null; full_name: string | null } | null);
      const e = one(r.employees as unknown as { display_name: string; position: string | null; phone: string | null } | null);
      return {
        membershipId: r.id,
        userId: r.user_id,
        role: r.role as StaffRole,
        isActive: r.is_active,
        email: p?.email ?? null,
        displayName: e?.display_name ?? p?.full_name ?? p?.email ?? 'Sin nombre',
        position: e?.position ?? null,
        phone: e?.phone ?? null,
        createdAt: r.created_at,
        isMe: r.user_id === ctx.userId,
      };
    })
    .sort((a, b) => ORDER[a.role] - ORDER[b.role] || Number(b.isActive) - Number(a.isActive) || a.displayName.localeCompare(b.displayName));

  return (
    <>
      <PageHeader title="Equipo" description="Crea cuentas individuales para cada persona y controla sus permisos." />
      <TeamManager members={members} timezone={ctx.business.timezone} />
    </>
  );
}
