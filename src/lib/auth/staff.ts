import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Business, StaffRole } from '@/lib/types';

export const ACTIVE_BUSINESS_COOKIE = 'webya_business';

export interface StaffMembership {
  id: string;
  role: StaffRole;
  business: Business;
}

export interface StaffContext {
  userId: string;
  email: string | null;
  fullName: string | null;
  isPlatformAdmin: boolean;
  memberships: StaffMembership[];
  business: Business | null;
  role: StaffRole | null;
}

/** Contexto del personal autenticado. Se resuelve una vez por petición. */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('full_name, email, kind, is_platform_admin').eq('id', user.id).maybeSingle(),
    supabase
      .from('memberships')
      .select('id, role, business:businesses(*)')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ]);

  const memberships: StaffMembership[] = ((rows ?? []) as unknown as { id: string; role: StaffRole; business: Business | null }[])
    .filter((m) => m.business && m.business.is_active)
    .map((m) => ({ id: m.id, role: m.role, business: m.business as Business }))
    .sort((a, b) => a.business.name.localeCompare(b.business.name));

  const cookieStore = await cookies();
  const headerStore = await headers();
  const preferredId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  const tenantSlug = headerStore.get('x-webya-tenant');

  const active =
    (tenantSlug && memberships.find((m) => m.business.slug === tenantSlug)) ||
    memberships.find((m) => m.business.id === preferredId) ||
    memberships[0] ||
    null;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    isPlatformAdmin: Boolean(profile?.is_platform_admin),
    memberships,
    business: active?.business ?? null,
    role: active?.role ?? null,
  };
});

export type ActiveStaffContext = StaffContext & { business: Business; role: StaffRole };

/** Exige personal con negocio activo y (opcionalmente) uno de los roles. */
export async function requireStaff(roles?: StaffRole[]): Promise<ActiveStaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect('/admin/login');
  if (!ctx.business || !ctx.role) redirect('/admin/sin-acceso');
  if (roles && !roles.includes(ctx.role)) redirect('/admin?denegado=1');
  return ctx as ActiveStaffContext;
}

/** Variante para Server Actions: no redirige, devuelve null si no autoriza. */
export async function authorizeStaff(roles?: StaffRole[]): Promise<ActiveStaffContext | null> {
  const ctx = await getStaffContext();
  if (!ctx?.business || !ctx.role) return null;
  if (roles && !roles.includes(ctx.role)) return null;
  return ctx as ActiveStaffContext;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Administrador principal',
  manager: 'Gerente',
  employee: 'Empleado',
};
