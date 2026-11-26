import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { Download, ExternalLink, Globe } from 'lucide-react';
import { requireStaff } from '@/lib/auth/staff';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { publicEnv } from '@/lib/env';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Configuración' };

export default async function SettingsPage() {
  const ctx = await requireStaff(['owner']);
  const b = ctx.business;
  const portalUrl = b.custom_domain ? `https://${b.custom_domain}` : `${publicEnv.siteUrl}/c/${b.slug}`;
  const qr = await QRCode.toDataURL(portalUrl, { width: 640, margin: 2, color: { dark: '#241810', light: '#FFFFFF' }, errorCorrectionLevel: 'M' });

  return (
    <>
      <PageHeader title="Configuración" description="Identidad visual, datos de contacto y parámetros del establecimiento." />
      <Card className="mb-6">
        <CardHeader title="Código QR de registro" description="Imprímelo y colócalo en mostrador o mesas. Los clientes se registran y consultan su tarjeta sin instalar apps." />
        <CardBody className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`Código QR hacia ${portalUrl}`} className="size-40 rounded-2xl border border-line bg-white p-2" />
          <div className="space-y-3">
            <p className="break-all font-mono text-sm text-ink-soft">{portalUrl}</p>
            <div className="flex flex-wrap gap-2">
              <a href={qr} download={`qr-${b.slug}.png`} className={buttonClasses('primary', 'sm')}><Download className="size-4" /> Descargar PNG</a>
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary', 'sm')}><ExternalLink className="size-4" /> Abrir portal</a>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Globe className="size-3.5" />
              {b.custom_domain ? `Dominio propio: ${b.custom_domain} (panel en ${b.custom_domain}/admin)` : 'Dominio propio: no configurado. Solicítalo a WebYA.'}
            </p>
          </div>
        </CardBody>
      </Card>
      <SettingsForm business={b} />
    </>
  );
}
