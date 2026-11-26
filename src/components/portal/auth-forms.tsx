'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { customerJoin, customerLogin, customerRegister } from '@/server/auth-actions';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';
import { PhoneInput } from '@/components/ui/phone-input';

function Consents({ slug, businessName }: { slug: string; businessName: string }) {
  return (
    <div className="space-y-3 rounded-2xl bg-cream-100/70 p-4">
      <Checkbox id="acceptTerms" name="acceptTerms" required label={<>Acepto el <Link href={`/c/${slug}/privacidad`} target="_blank" className="font-medium underline">aviso de privacidad</Link></>} />
      <Checkbox id="marketingOptIn" name="marketingOptIn" label={`Quiero recibir promociones de ${businessName}`} description="Opcional. Puedes cancelarlo cuando quieras desde tu perfil." />
    </div>
  );
}

export function RegisterForm({ slug, businessName, next, country }: { slug: string; businessName: string; next?: string; country: string }) {
  const [state, action] = useActionState(customerRegister.bind(null, slug), null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const v = state && !state.ok ? state.values : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ''} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" htmlFor="firstName" error={fe?.firstName}><Input id="firstName" name="firstName" defaultValue={v?.firstName} autoComplete="given-name" required /></Field>
        <Field label="Apellido" htmlFor="lastName" error={fe?.lastName}><Input id="lastName" name="lastName" defaultValue={v?.lastName} autoComplete="family-name" required /></Field>
      </div>
      <Field label="Teléfono celular" htmlFor="phone" error={fe?.phone} hint="Será tu usuario para entrar.">
        <PhoneInput id="phone" defaultCountry={v?.country || country} defaultValue={v?.phone} invalid={!!fe?.phone} />
      </Field>
      <Field label="Correo electrónico" htmlFor="email" error={fe?.email} optional>
        <Input id="email" name="email" defaultValue={v?.email} type="email" autoComplete="email" />
      </Field>
      <Field label="Crea una contraseña" htmlFor="password" error={fe?.password} hint="Mínimo 8 caracteres, con letras y números.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirma tu contraseña" htmlFor="confirmPassword" error={fe?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Consents slug={slug} businessName={businessName} />
      {fe?.acceptTerms && <p className="text-xs text-danger">{fe.acceptTerms}</p>}
      <SubmitButton variant="brand" size="lg" className="w-full" pendingText="Creando tu tarjeta…">Crear mi tarjeta</SubmitButton>
    </form>
  );
}

export function LoginForm({ slug, next, country }: { slug: string; next?: string; country: string }) {
  const [state, action] = useActionState(customerLogin.bind(null, slug), null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const v = state && !state.ok ? state.values : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ''} />
      <FormMessage state={state} />
      <Field label="Teléfono celular" htmlFor="phone" error={fe?.phone}>
        <PhoneInput id="phone" defaultCountry={v?.country || country} defaultValue={v?.phone} invalid={!!fe?.phone} autoFocus />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fe?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton variant="brand" size="lg" className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}

export function JoinForm({ slug, businessName, defaultName, next }: { slug: string; businessName: string; defaultName?: { first: string; last: string }; next?: string }) {
  const [state, action] = useActionState(customerJoin.bind(null, slug), null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" htmlFor="firstName"><Input id="firstName" name="firstName" defaultValue={defaultName?.first} required /></Field>
        <Field label="Apellido" htmlFor="lastName"><Input id="lastName" name="lastName" defaultValue={defaultName?.last} required /></Field>
      </div>
      <Field label="Correo electrónico" htmlFor="email" optional><Input id="email" name="email" type="email" /></Field>
      <Consents slug={slug} businessName={businessName} />
      <SubmitButton variant="brand" size="lg" className="w-full" pendingText="Activando…">Activar mi tarjeta</SubmitButton>
    </form>
  );
}
