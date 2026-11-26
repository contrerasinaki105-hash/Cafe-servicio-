import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCustomerSession, getPublicBusiness } from '@/lib/auth/customer';
import { PortalHeader } from '@/components/portal/portal-header';
import { RegisterForm } from '@/components/portal/auth-forms';

export const metadata: Metadata = { title: 'Crear tarjeta' };

export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = (await getPublicBusiness(slug))!;
  const session = await getCustomerSession(business.id);
  if (session?.customer) redirect(`/c/${slug}/tarjeta`);
  if (session?.isCustomerAccount) redirect(`/c/${slug}/unirse`);
  return (
    <>
      <PortalHeader business={business} />
      <main className="mx-auto max-w-lg px-4 pb-16 pt-8 animate-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu tarjeta digital</h1>
        <p className="mt-1 text-sm text-ink-muted">Tarda menos de un minuto.</p>
        <div className="mt-6"><RegisterForm slug={slug} businessName={business.name} /></div>
        <p className="mt-6 text-center text-sm text-ink-muted">¿Ya tienes cuenta? <Link href={`/c/${slug}/entrar`} className="font-medium text-[var(--brand)] hover:underline">Entra aquí</Link></p>
      </main>
    </>
  );
}
