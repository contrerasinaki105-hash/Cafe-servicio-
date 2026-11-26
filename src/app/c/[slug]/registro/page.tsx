import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCustomerSession, getPublicBusiness } from '@/lib/auth/customer';
import { PortalHeader } from '@/components/portal/portal-header';
import { RegisterForm } from '@/components/portal/auth-forms';

export const metadata: Metadata = { title: 'Crear tarjeta' };

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const next = sp.next && /^\/s\/[a-f0-9]{36}$/.test(sp.next) ? sp.next : undefined;
  const q = next ? `?next=${encodeURIComponent(next)}` : '';
  const business = (await getPublicBusiness(slug))!;
  const session = await getCustomerSession(business.id);
  if (session?.customer) redirect(next ?? `/c/${slug}/tarjeta`);
  if (session?.isCustomerAccount) redirect(`/c/${slug}/unirse${q}`);
  return (
    <>
      <PortalHeader business={business} />
      <main className="mx-auto max-w-lg px-4 pb-16 pt-8 animate-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu tarjeta digital</h1>
        <p className="mt-1 text-sm text-ink-muted">Tarda menos de un minuto.</p>
        <div className="mt-6"><RegisterForm next={next} country={business.country_code} slug={slug} businessName={business.name} /></div>
        <p className="mt-6 text-center text-sm text-ink-muted">¿Ya tienes cuenta? <Link href={`/c/${slug}/entrar${q}`} className="font-medium text-[var(--brand)] hover:underline">Entra aquí</Link></p>
      </main>
    </>
  );
}
