'use client';
import { useActionState } from 'react';
import { requestPasswordReset } from '@/server/auth-actions';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';

export function RecoverForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Correo electrónico" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}
