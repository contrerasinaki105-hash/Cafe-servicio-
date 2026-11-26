import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaffContext } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/server/auth-actions';
import { WebyaLogo } from '@/components/brand/logo';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { CreateBusinessForm } from './create-business-form';

export const metadata: Metadata = { title: 'Plataforma WebYA' };

export default async function PlatformPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect('/admin/login');
  if (!ctx.isPlatformAdmin) redirect('/admin');
  const supabase = await createClient();
  const { data: businesses } = await supabase.from('businesses').select('id, slug, name, custom_domain, is_active, created_at').order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between">
        <WebyaLogo />
        <div className="flex items-center gap-2">
          {ctx.business && <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">Ir al panel</Link>}
          <form action={signOut}><Button size="sm" variant="ghost" type="submit">Salir</Button></form>
        </div>
      </header>
      <h1 className="text-2xl font-semibold tracking-tight">Negocios en la plataforma</h1>
      <p className="mt-1 text-sm text-ink-muted">Alta de nuevos establecimientos. Cada negocio tiene sus datos aislados por políticas RLS.</p>

      <Card className="mt-6">
        <CardHeader title="Nuevo negocio" />
        <CardBody><CreateBusinessForm /></CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title={`${businesses?.length ?? 0} negocios`} />
        <ul className="divide-y divide-line">
          {(businesses ?? []).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{b.name} {!b.is_active && <Badge tone="danger">Inactivo</Badge>}</p>
                <p className="text-xs text-ink-muted">/c/{b.slug}{b.custom_domain ? ` · ${b.custom_domain}` : ''} · alta {formatDate(b.created_at)}</p>
              </div>
              <Link href={`/c/${b.slug}`} className="text-[13px] font-medium text-coffee-600 hover:underline" target="_blank">Ver portal</Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
