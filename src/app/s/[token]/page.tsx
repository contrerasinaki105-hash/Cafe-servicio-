import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCustomerSession, getPublicBusiness } from '@/lib/auth/customer';
import { PortalHeader } from '@/components/portal/portal-header';
import { buttonClasses } from '@/components/ui/button';
import { readableOn } from '@/lib/utils';
import { ClaimRunner } from './claim-runner';

export const metadata: Metadata = { title: 'Sumar sello' };

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_stamp_claim_public', { p_token: token });
  const info = data as { slug: string; name: string; stamps: number; valid: boolean } | null;
  if (!info) notFound();
  const business = await getPublicBusiness(info.slug);
  if (!business) notFound();

  const next = `?next=${encodeURIComponent(`/s/${token}`)}`;
  const session = await getCustomerSession(business.id);
  if (info.valid) {
    if (!session) redirect(`/c/${info.slug}/registro${next}`);
    if (!session.customer) redirect(session.isCustomerAccount ? `/c/${info.slug}/unirse${next}` : `/c/${info.slug}/registro${next}`);
  }

  return (
    <div
      className="min-h-dvh"
      style={{ ['--brand' as string]: business.primary_color, ['--brand-accent' as string]: business.accent_color, ['--brand-contrast' as string]: readableOn(business.primary_color) }}
    >
      <PortalHeader business={business} />
      <main className="mx-auto max-w-sm px-5 pb-16 pt-12">
        {session?.customer ? (
          <ClaimRunner token={token} slug={info.slug} required={business.program?.stamps_required ?? 10} />
        ) : (
          <div className="text-center animate-rise">
            <Clock className="mx-auto size-12 text-warning" />
            <p className="mt-4 text-lg font-semibold">Este código ya no es válido</p>
            <p className="mt-1 text-sm text-ink-muted">Pide al personal de {business.name} que genere uno nuevo.</p>
            <Link href={`/c/${info.slug}`} className={buttonClasses('secondary', 'lg', 'mt-6 w-full')}>Ir a {business.name}</Link>
          </div>
        )}
      </main>
    </div>
  );
}
