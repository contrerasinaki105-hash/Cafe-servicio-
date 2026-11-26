import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/admin/auth-shell';
import { getStaffContext } from '@/lib/auth/staff';
import { getHostBrand } from '@/lib/tenant';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Acceso al panel' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const ctx = await getStaffContext();
  if (ctx?.business) redirect('/admin');
  const brand = await getHostBrand();
  return (
    <AuthShell title="Inicia sesión" subtitle="Accede al panel de tu establecimiento." brand={brand}>
      <LoginForm next={next} />
    </AuthShell>
  );
}
