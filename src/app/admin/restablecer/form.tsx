'use client';
import { useActionState } from 'react';
import { completePasswordReset } from '@/server/auth-actions';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';

export function ResetForm() {
  const [state, action] = useActionState(completePasswordReset, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Nueva contraseña" htmlFor="newPassword" error={fe?.newPassword} hint="Mínimo 8 caracteres, con letras y números.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Field label="Confirmar contraseña" htmlFor="confirmPassword" error={fe?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
