'use client';
import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { changePassword } from '@/server/auth-actions';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      ref.current?.reset();
    }
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form ref={ref} action={action} className="max-w-md space-y-4">
      {state && !state.ok && <FormMessage state={state} />}
      <Field label="Contraseña actual" htmlFor="cp-current" error={fe?.currentPassword}><Input id="cp-current" name="currentPassword" type="password" autoComplete="current-password" required /></Field>
      <Field label="Nueva contraseña" htmlFor="cp-new" error={fe?.newPassword} hint="Mínimo 8 caracteres, con letras y números."><Input id="cp-new" name="newPassword" type="password" autoComplete="new-password" required /></Field>
      <Field label="Confirmar nueva contraseña" htmlFor="cp-confirm" error={fe?.confirmPassword}><Input id="cp-confirm" name="confirmPassword" type="password" autoComplete="new-password" required /></Field>
      <SubmitButton pendingText="Actualizando…">Cambiar contraseña</SubmitButton>
    </form>
  );
}
