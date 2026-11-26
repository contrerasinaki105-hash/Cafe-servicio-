import type { Metadata } from 'next';
import { getPublicBusiness } from '@/lib/auth/customer';
import { PortalHeader } from '@/components/portal/portal-header';

export const metadata: Metadata = { title: 'Aviso de privacidad' };

export default async function PrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = (await getPublicBusiness(slug))!;
  return (
    <>
      <PortalHeader business={b} />
      <main className="prose-sm mx-auto max-w-lg space-y-4 px-4 pb-16 pt-8 text-sm leading-relaxed text-ink-soft">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Aviso de privacidad</h1>
        <p className="rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning">Plantilla base. Cada establecimiento debe revisarla con su asesor legal y completar sus datos de responsable.</p>
        <p><strong className="text-ink">Responsable:</strong> {b.name}{b.address ? `, ${b.address}` : ''}{b.city ? `, ${b.city}` : ''}.</p>
        <p><strong className="text-ink">Datos que recabamos:</strong> nombre, apellido, número de teléfono y, si lo proporcionas, correo electrónico; además del historial de visitas, sellos y recompensas.</p>
        <p><strong className="text-ink">Finalidad:</strong> administrar tu tarjeta de fidelidad, registrar tus compras y recompensas, e identificarte en el establecimiento. Solo si lo autorizas, enviarte promociones.</p>
        <p><strong className="text-ink">Consentimiento para promociones:</strong> es opcional y puedes retirarlo en cualquier momento desde tu perfil.</p>
        <p><strong className="text-ink">Transferencias:</strong> tus datos no se venden ni se comparten con otros negocios. La plataforma tecnológica (WebYA) actúa como encargada del tratamiento.</p>
        <p><strong className="text-ink">Derechos:</strong> puedes solicitar acceso, rectificación, cancelación u oposición contactando al establecimiento{b.contact_phone ? ` al ${b.contact_phone}` : ''}.</p>
      </main>
    </>
  );
}
