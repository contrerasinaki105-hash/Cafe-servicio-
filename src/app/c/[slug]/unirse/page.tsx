import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCustomerSession, getPublicBusiness } from '@/lib/auth/customer';
import { PortalHeader } from '@/components/portal/portal-header';
import { JoinForm } from '@/components/portal/auth-forms';

export const metadata: Metadata = { title: 'Activar tarjeta' };

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = (await getPublicBusiness(slug))!;
  const session = await getCustomerSession(business.id);
  if (!session) redirect(`/c/${slug}/entrar`);
  if (session.customer) redirect(`/c/${slug}/tarjeta`);
  if (!session.isCustomerAccount) redirect(`/c/${slug}`);
  return (
    <>
      <PortalHeader business={business} />
      <main className="mx-auto max-w-lg px-4 pb-16 pt-8 animate-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Activa tu tarjeta en {business.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">Ya tienes cuenta en WebYA. Solo confirma tus datos para este negocio.</p>
        <div className="mt-6"><JoinForm slug={slug} businessName={business.name} /></div>
      </main>
    </>
  );
}
