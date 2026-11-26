'use client';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { createCustomer } from '@/server/admin-actions';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';

export function NewCustomerForm({ onCreated, defaultPhone }: { onCreated: (id: string) => void; defaultPhone?: string }) {
  const [state, action] = useActionState(createCustomer, null);
  useEffect(() => {
    if (state?.ok && state.data) {
      toast.success('Cliente registrado');
      onCreated(state.data.id);
    }
  }, [state, onCreated]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <FormMessage state={state} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="nc-first" error={fe?.firstName}>
          <Input id="nc-first" name="firstName" required autoFocus autoComplete="off" />
        </Field>
        <Field label="Apellido" htmlFor="nc-last" error={fe?.lastName}>
          <Input id="nc-last" name="lastName" required autoComplete="off" />
        </Field>
      </div>
      <Field label="Teléfono" htmlFor="nc-phone" error={fe?.phone}>
        <Input id="nc-phone" name="phone" type="tel" inputMode="tel" required defaultValue={defaultPhone} />
      </Field>
      <Field label="Correo electrónico" htmlFor="nc-email" error={fe?.email} optional>
        <Input id="nc-email" name="email" type="email" />
      </Field>
      <Checkbox id="nc-optin" name="marketingOptIn" label="El cliente acepta recibir promociones" description="Solo marca esta casilla si el cliente lo autorizó expresamente." />
      <SubmitButton className="w-full" pendingText="Guardando…">Registrar cliente</SubmitButton>
    </form>
  );
}
