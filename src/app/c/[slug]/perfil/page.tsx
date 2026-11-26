import type { Metadata } from 'next';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { requireCustomer } from '@/lib/auth/require-customer';
import { customerSignOut } from '@/server/customer-actions';
import { PortalHeader } from '@/components/portal/portal-header';
import { BottomNav } from '@/components/portal/bottom-nav';
import { ConsentToggle } from '@/components/portal/consent-toggle';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { formatPhone } from '@/lib/phone';

export const metadata: Metadata = { title: 'Perfil' };

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, customer } = await requireCustomer(slug);
  return (
    <>
      <PortalHeader business={business} />
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <dl className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
          {[
            ['Nombre', `${customer.first_name} ${customer.last_name}`],
            ['Teléfono', formatPhone(customer.phone)],
            ['Correo', customer.email ?? 'No registrado'],
            ['Miembro desde', formatDate(customer.created_at)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <ConsentToggle slug={slug} businessId={business.id} initial={customer.marketing_opt_in} />
        </div>
        <p className="mt-4 text-xs text-ink-muted">Para corregir tus datos, pídeselo al personal de {business.name}. <Link href={`/c/${slug}/privacidad`} className="underline">Aviso de privacidad</Link>.</p>
        <form action={customerSignOut.bind(null, slug)} className="mt-6">
          <Button type="submit" variant="secondary" className="w-full"><LogOut className="size-4" /> Cerrar sesión</Button>
        </form>
      </main>
      <BottomNav slug={slug} />
    </>
  );
}
