import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/admin/auth-shell';
import { getStaffContext } from '@/lib/auth/staff';
import { getHostBrand } from '@/lib/tenant';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Acceso al panel' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; acceso?: string }> }) {
  const { next, acceso } = await searchParams;
  const ctx = await getStaffContext();
  if (ctx?.business) redirect('/admin');
  const brand = await getHostBrand();
  return (
    <AuthShell title="Inicia sesión" subtitle="Accede al panel de tu establecimiento." brand={brand}>
      {(acceso || (ctx && !ctx.business && !ctx.isPlatformAdmin)) && (
        <p className="mb-4 rounded-xl border border-line bg-cream-100 px-3.5 py-2.5 text-sm text-ink-soft">
          La sesión abierta en este dispositivo no tiene acceso al panel. Entra con el correo y la contraseña de tu cuenta del personal.
        </p>
      )}
      <LoginForm next={next} />
    </AuthShell>
  );
}
