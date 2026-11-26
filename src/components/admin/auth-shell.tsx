import type { ReactNode } from 'react';
import { RemoteImage as Image } from '@/components/ui/remote-image';
import { WebyaLogo } from '@/components/brand/logo';
import { readableOn } from '@/lib/utils';

export interface ShellBrand {
  name: string;
  logo_url: string | null;
  primary_color: string;
}

/** Pantalla de acceso del panel: dos columnas en escritorio, una en móvil. */
export function AuthShell({ title, subtitle, children, brand }: { title: string; subtitle?: ReactNode; children: ReactNode; brand?: ShellBrand | null }) {
  const color = brand?.primary_color ?? '#241810';
  return (
    <main
      className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]"
      style={{ ['--brand' as string]: brand?.primary_color ?? '#6f4e37', ['--brand-contrast' as string]: readableOn(brand?.primary_color ?? '#6f4e37') }}
    >
      <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between p-12" style={{ background: color }}>
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }} />
        <div className="relative">
          {brand ? (
            <div className="flex items-center gap-3">
              {brand.logo_url && <Image src={brand.logo_url} alt="" width={40} height={40} className="size-10 rounded-xl object-cover" />}
              <span className="text-lg font-semibold" style={{ color: readableOn(color) }}>{brand.name}</span>
            </div>
          ) : (
            <WebyaLogo light />
          )}
        </div>
        <div className="relative max-w-md" style={{ color: readableOn(color) }}>
          <p className="text-3xl font-semibold leading-tight tracking-tight">Cada visita cuenta. Cada cliente vuelve.</p>
          <p className="mt-4 text-[15px] opacity-75">Registra compras en segundos, premia a tus clientes frecuentes y entiende tu negocio con datos reales.</p>
        </div>
        <p className="relative text-xs opacity-60" style={{ color: readableOn(color) }}>Panel privado · Acceso solo para personal autorizado</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            {brand ? <p className="text-lg font-semibold">{brand.name}</p> : <WebyaLogo />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {brand && (
            <p className="mt-10 text-center text-xs text-ink-muted">
              Con tecnología de <span className="font-medium text-ink-soft">WebYA Loyalty</span>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
