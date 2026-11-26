import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/admin/auth-shell';
import { createClient } from '@/lib/supabase/server';
import { ResetForm } from './form';

export const metadata: Metadata = { title: 'Nueva contraseña' };

export default async function ResetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <AuthShell title="Crea una nueva contraseña" subtitle={user?.email ? `Cuenta: ${user.email}` : undefined}>
      {user ? (
        <ResetForm />
      ) : (
        <div className="space-y-4 text-sm text-ink-soft">
          <p>El enlace de recuperación no es válido o ya expiró.</p>
          <Link href="/admin/recuperar" className="font-medium text-coffee-600 hover:underline">Solicitar un nuevo enlace</Link>
        </div>
      )}
    </AuthShell>
  );
}
