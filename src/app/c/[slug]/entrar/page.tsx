import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCustomerSession, getPublicBusiness } from '@/lib/auth/customer';
import { PortalHeader } from '@/components/portal/portal-header';
import { LoginForm } from '@/components/portal/auth-forms';

export const metadata: Metadata = { title: 'Entrar' };

export default async function CustomerLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = (await getPublicBusiness(slug))!;
  const session = await getCustomerSession(business.id);
  if (session?.customer) redirect(`/c/${slug}/tarjeta`);
  return (
    <>
      <PortalHeader business={business} />
      <main className="mx-auto max-w-lg px-4 pb-16 pt-8 animate-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Entra a tu tarjeta</h1>
        <p className="mt-1 text-sm text-ink-muted">Usa el teléfono con el que te registraste.</p>
        <div className="mt-6"><LoginForm slug={slug} /></div>
        <p className="mt-6 text-center text-sm text-ink-muted">¿Aún no tienes tarjeta? <Link href={`/c/${slug}/registro`} className="font-medium text-[var(--brand)] hover:underline">Créala gratis</Link></p>
        <p className="mt-3 text-center text-xs text-ink-muted">¿Olvidaste tu contraseña? Pídele al personal de {business.name} que la restablezca.</p>
      </main>
    </>
  );
}
