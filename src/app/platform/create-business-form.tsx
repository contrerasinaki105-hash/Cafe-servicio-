'use client';
import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { createBusiness } from '@/server/platform-actions';
import { Field, Input, Select } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';

export function CreateBusinessForm() {
  const [state, action] = useActionState(createBusiness, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      ref.current?.reset();
    }
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form ref={ref} action={action} className="space-y-4" autoComplete="off">
      {state && !state.ok && <FormMessage state={state} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del negocio" htmlFor="pb-name" error={fe?.name}><Input id="pb-name" name="name" required placeholder="Café Aurora" /></Field>
        <Field label="Identificador (URL)" htmlFor="pb-slug" error={fe?.slug} hint="cafeaurora → /c/cafeaurora"><Input id="pb-slug" name="slug" required pattern="[a-z0-9-]{3,48}" placeholder="cafeaurora" /></Field>
        <Field label="Dominio propio" htmlFor="pb-domain" optional hint="Ej. cafeaurora.com (configurar DNS en Vercel)"><Input id="pb-domain" name="customDomain" placeholder="cafeaurora.com" /></Field>
        <Field label="País" htmlFor="pb-country">
          <Select id="pb-country" name="countryCode" defaultValue="MX">
            {[['MX', 'México'], ['CO', 'Colombia'], ['PE', 'Perú'], ['CL', 'Chile'], ['AR', 'Argentina'], ['ES', 'España'], ['US', 'Estados Unidos'], ['GT', 'Guatemala'], ['CR', 'Costa Rica'], ['DO', 'Rep. Dominicana'], ['EC', 'Ecuador']].map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Zona horaria" htmlFor="pb-tz"><Input id="pb-tz" name="timezone" defaultValue="America/Mexico_City" required /></Field>
        <Field label="Moneda" htmlFor="pb-cur"><Input id="pb-cur" name="currency" defaultValue="MXN" maxLength={3} required /></Field>
      </div>
      <hr className="border-line" />
      <p className="text-sm font-semibold">Propietario (administrador principal)</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nombre" htmlFor="pb-oname" error={fe?.ownerName}><Input id="pb-oname" name="ownerName" required /></Field>
        <Field label="Correo" htmlFor="pb-oemail" error={fe?.ownerEmail}><Input id="pb-oemail" name="ownerEmail" type="email" required /></Field>
        <Field label="Contraseña inicial" htmlFor="pb-opass" error={fe?.ownerPassword}><Input id="pb-opass" name="ownerPassword" type="text" required minLength={8} autoComplete="new-password" /></Field>
      </div>
      <SubmitButton pendingText="Creando…">Crear negocio</SubmitButton>
    </form>
  );
}
