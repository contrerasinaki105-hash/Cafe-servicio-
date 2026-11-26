'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { staffLogin } from '@/server/auth-actions';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(staffLogin, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const v = state && !state.ok ? state.values : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ''} />
      <FormMessage state={state} />
      <Field label="Correo electrónico" htmlFor="email" error={fe?.email}>
        <Input id="email" name="email" defaultValue={v?.email} type="email" autoComplete="username" required autoFocus aria-invalid={!!fe?.email} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fe?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!fe?.password} />
      </Field>
      <div className="flex justify-end">
        <Link href="/admin/recuperar" className="text-[13px] font-medium text-coffee-600 hover:underline">¿Olvidaste tu contraseña?</Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Verificando…">Iniciar sesión</SubmitButton>
    </form>
  );
}
