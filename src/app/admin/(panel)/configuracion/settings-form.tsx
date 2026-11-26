'use client';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus } from 'lucide-react';
import { saveBusinessSettings } from '@/server/admin-actions';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';
import { RemoteImage } from '@/components/ui/remote-image';
import { readableOn, initials } from '@/lib/utils';
import type { Business } from '@/lib/types';

const TIMEZONES = [
  'America/Mexico_City', 'America/Monterrey', 'America/Cancun', 'America/Tijuana', 'America/Hermosillo', 'America/Bogota',
  'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Caracas', 'America/Guatemala',
  'America/Costa_Rica', 'America/Panama', 'America/Santo_Domingo', 'America/New_York', 'America/Los_Angeles', 'Europe/Madrid', 'UTC',
];

export function SettingsForm({ business }: { business: Business }) {
  const [state, action] = useActionState(saveBusinessSettings, null);
  const [primary, setPrimary] = useState(business.primary_color);
  const [accent, setAccent] = useState(business.accent_color);
  const [name, setName] = useState(business.name);
  const [logo, setLogo] = useState<string | null>(business.logo_url);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const tzs = TIMEZONES.includes(business.timezone) ? TIMEZONES : [business.timezone, ...TIMEZONES];

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {state && !state.ok && <FormMessage state={state} />}
        <Section title="Identidad">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del negocio" htmlFor="b-name" error={fe?.name}><Input id="b-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Lema" htmlFor="b-tag" optional><Input id="b-tag" name="tagline" defaultValue={business.tagline ?? ''} maxLength={160} placeholder="Café de especialidad" /></Field>
          </div>
          <Field label="Logotipo" htmlFor="b-logo" optional hint="Cuadrado, PNG/JPG/WEBP, máx. 2 MB.">
            <div className="flex items-center gap-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-cream-100">
                {logo ? <RemoteImage src={logo} alt="" fill className="object-cover" /> : <ImagePlus className="m-auto mt-5 size-6 text-ink-muted" />}
              </div>
              <input id="b-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp"
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cream-100 file:px-3 file:py-2 file:text-sm file:font-medium"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogo(URL.createObjectURL(f)); }} />
            </div>
          </Field>
          {business.logo_url && <Checkbox id="b-rmlogo" name="removeLogo" label="Quitar el logotipo actual" />}
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField id="b-primary" name="primaryColor" label="Color principal" value={primary} onChange={setPrimary} error={fe?.primaryColor} />
            <ColorField id="b-accent" name="accentColor" label="Color de acento" value={accent} onChange={setAccent} error={fe?.accentColor} />
          </div>
        </Section>

        <Section title="Contacto y ubicación">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correo de contacto" htmlFor="b-email" optional error={fe?.contactEmail}><Input id="b-email" name="contactEmail" type="email" defaultValue={business.contact_email ?? ''} /></Field>
            <Field label="Teléfono" htmlFor="b-phone" optional><Input id="b-phone" name="contactPhone" type="tel" defaultValue={business.contact_phone ?? ''} /></Field>
            <Field label="WhatsApp" htmlFor="b-wa" optional><Input id="b-wa" name="whatsapp" type="tel" defaultValue={business.whatsapp ?? ''} /></Field>
            <Field label="Ciudad" htmlFor="b-city" optional><Input id="b-city" name="city" defaultValue={business.city ?? ''} /></Field>
          </div>
          <Field label="Dirección" htmlFor="b-addr" optional><Input id="b-addr" name="address" defaultValue={business.address ?? ''} /></Field>
        </Section>

        <Section title="Operación">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Zona horaria" htmlFor="b-tz"><Select id="b-tz" name="timezone" defaultValue={business.timezone}>{tzs.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</Select></Field>
            <Field label="Moneda" htmlFor="b-cur" error={fe?.currency}><Input id="b-cur" name="currency" defaultValue={business.currency} maxLength={3} required className="uppercase" /></Field>
            <Field label="Inactivo tras (días)" htmlFor="b-inact" error={fe?.inactiveAfterDays} hint="Para estadísticas y campañas.">
              <Input id="b-inact" name="inactiveAfterDays" type="number" min={7} max={365} defaultValue={business.inactive_after_days} required />
            </Field>
          </div>
        </Section>
        <SubmitButton pendingText="Guardando…">Guardar configuración</SubmitButton>
      </div>

      <aside className="lg:sticky lg:top-10 lg:self-start">
        <p className="mb-2 text-[13px] font-medium text-ink-muted">Vista previa de la tarjeta</p>
        <div className="overflow-hidden rounded-3xl p-5 shadow-pop" style={{ background: primary, color: readableOn(primary) }}>
          <div className="flex items-center gap-3">
            {logo ? <span className="relative size-10 overflow-hidden rounded-xl"><RemoteImage src={logo} alt="" fill className="object-cover" /></span>
              : <span className="grid size-10 place-items-center rounded-xl text-sm font-bold" style={{ background: accent, color: readableOn(accent) }}>{initials(name || 'C')}</span>}
            <span className="font-semibold">{name || 'Tu negocio'}</span>
          </div>
          <div className="mt-6 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="aspect-square rounded-full border-2" style={{ borderColor: `${readableOn(primary)}40`, background: i < 6 ? accent : 'transparent' }} />
            ))}
          </div>
          <p className="mt-4 text-sm opacity-80">6 de 10 sellos</p>
        </div>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ColorField({ id, name, label, value, onChange, error }: { id: string; name: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex gap-2">
        <input type="color" aria-label={`${label} (selector)`} value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-xl border border-line-strong bg-surface p-1" />
        <Input id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} pattern="#[0-9A-Fa-f]{6}" required className="font-mono uppercase" />
      </div>
    </Field>
  );
}
