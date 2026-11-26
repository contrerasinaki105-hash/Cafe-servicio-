import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicBusiness } from '@/lib/auth/customer';
import { readableOn } from '@/lib/utils';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  return b ? { title: { default: b.name, template: `%s · ${b.name}` }, description: `Tarjeta de fidelidad digital de ${b.name}` } : {};
}

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,48}$/.test(slug)) notFound();
  const business = await getPublicBusiness(slug);
  if (!business) notFound();
  return (
    <div
      className="min-h-dvh"
      style={{
        ['--brand' as string]: business.primary_color,
        ['--brand-accent' as string]: business.accent_color,
        ['--brand-contrast' as string]: readableOn(business.primary_color),
      }}
    >
      {children}
    </div>
  );
}
