import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/admin/auth-shell';
import { getHostBrand } from '@/lib/tenant';
import { RecoverForm } from './form';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default async function RecoverPage() {
  const brand = await getHostBrand();
  return (
    <AuthShell title="Recupera tu acceso" subtitle="Te enviaremos un enlace seguro para crear una nueva contraseña." brand={brand}>
      <RecoverForm />
      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/admin/login" className="font-medium text-coffee-600 hover:underline">Volver a iniciar sesión</Link>
      </p>
    </AuthShell>
  );
}
