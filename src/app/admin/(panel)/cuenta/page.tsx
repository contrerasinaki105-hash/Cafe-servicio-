import type { Metadata } from 'next';
import { requireStaff, ROLE_LABELS } from '@/lib/auth/staff';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PasswordForm } from './password-form';

export const metadata: Metadata = { title: 'Mi cuenta' };

export default async function AccountPage() {
  const ctx = await requireStaff();
  return (
    <>
      <PageHeader title="Mi cuenta" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Datos de acceso" />
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">Nombre</dt><dd className="font-medium">{ctx.fullName ?? '—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">Correo</dt><dd className="font-medium">{ctx.email}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">Negocio</dt><dd className="font-medium">{ctx.business.name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">Rol</dt><dd className="font-medium">{ROLE_LABELS[ctx.role]}</dd></div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cambiar contraseña" description="Por seguridad te pedimos tu contraseña actual." />
          <CardBody><PasswordForm /></CardBody>
        </Card>
      </div>
    </>
  );
}
