import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Gift, MapPin, Smartphone, Stamp } from 'lucide-react';
import { getCustomerSession, getPublicBusiness } from '@/lib/auth/customer';
import { PortalHeader } from '@/components/portal/portal-header';
import { buttonClasses } from '@/components/ui/button';

export default async function PortalHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = (await getPublicBusiness(slug))!;
  const session = await getCustomerSession(business.id);
  if (session?.customer) redirect(`/c/${slug}/tarjeta`);
  const required = business.program?.stamps_required ?? 10;

  return (
    <>
      <PortalHeader business={business} />
      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
        <section className="text-center animate-rise">
          <p className="text-sm font-medium text-[var(--brand)]">{business.program?.name ?? 'Tarjeta de fidelidad'}</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
            {required} compras = {business.program?.reward_description ?? 'una recompensa'}
          </h1>
          {business.tagline && <p className="mt-2 text-ink-muted">{business.tagline}</p>}
        </section>

        <div className="relative mx-auto mt-8 max-w-sm animate-rise [animation-delay:80ms]">
          <div className="rounded-3xl p-6 shadow-pop" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
            <p className="text-sm opacity-80">Tu tarjeta digital</p>
            <div className="mt-5 grid grid-cols-5 gap-2.5">
              {Array.from({ length: Math.min(required, 20) }).map((_, i) => (
                <span key={i} className="grid aspect-square place-items-center rounded-full border-2 border-current/25" style={i < 3 ? { background: 'var(--brand-accent)', borderColor: 'transparent' } : undefined}>
                  {i < 3 && <Stamp className="size-4 opacity-80" style={{ color: 'var(--brand)' }} aria-hidden />}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          <Link href={`/c/${slug}/registro`} className={buttonClasses('brand', 'lg', 'w-full')}>Crear mi tarjeta gratis</Link>
          <Link href={`/c/${slug}/entrar`} className={buttonClasses('secondary', 'lg', 'w-full')}>Ya tengo cuenta</Link>
        </div>

        <ul className="mt-10 space-y-4 text-sm">
          <li className="flex gap-3"><Smartphone className="size-5 shrink-0 text-[var(--brand)]" /><span><strong className="font-medium">Sin descargar apps.</strong> <span className="text-ink-muted">Tu tarjeta vive en tu teléfono.</span></span></li>
          <li className="flex gap-3"><Stamp className="size-5 shrink-0 text-[var(--brand)]" /><span><strong className="font-medium">Muestra tu código en cada compra.</strong> <span className="text-ink-muted">El personal registra tu sello.</span></span></li>
          <li className="flex gap-3"><Gift className="size-5 shrink-0 text-[var(--brand)]" /><span><strong className="font-medium">Recompensas automáticas.</strong> <span className="text-ink-muted">Te avisamos cuando consigas una.</span></span></li>
        </ul>

        {business.rewards.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold">Recompensas</h2>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {business.rewards.map((r) => (
                <li key={r.name + r.stamps_required} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="tabular text-ink-muted">{r.stamps_required} sellos</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(business.address || business.city) && (
          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-ink-muted"><MapPin className="size-3.5" />{[business.address, business.city].filter(Boolean).join(', ')}</p>
        )}
        <p className="mt-3 text-center text-xs text-ink-muted"><Link href={`/c/${slug}/privacidad`} className="underline">Aviso de privacidad</Link> · WebYA Loyalty</p>
      </main>
    </>
  );
}
