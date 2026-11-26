'use client';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { updateProgram } from '@/server/admin-actions';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';
import type { LoyaltyProgram } from '@/lib/types';

export function ProgramForm({ program }: { program: LoyaltyProgram }) {
  const [state, action] = useActionState(updateProgram, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <FormMessage state={state} />}
      <Field label="Nombre de la tarjeta" htmlFor="p-name" error={fe?.name}>
        <Input id="p-name" name="name" defaultValue={program.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sellos necesarios" htmlFor="p-stamps" error={fe?.stampsRequired} hint="Entre 3 y 50.">
          <Input id="p-stamps" name="stampsRequired" type="number" min={3} max={50} defaultValue={program.stamps_required} required />
        </Field>
        <Field label="Recompensa al completar" htmlFor="p-reward" error={fe?.rewardDescription}>
          <Input id="p-reward" name="rewardDescription" defaultValue={program.reward_description} required />
        </Field>
        <Field label="Máx. sellos por compra (empleados)" htmlFor="p-max" error={fe?.maxStampsPerVisit} hint="Gerentes pueden dar hasta 20.">
          <Input id="p-max" name="maxStampsPerVisit" type="number" min={1} max={20} defaultValue={program.max_stamps_per_visit} required />
        </Field>
        <Field label="Minutos entre compras del mismo cliente" htmlFor="p-cool" error={fe?.cooldownMinutes} hint="Evita registros duplicados. 0 = sin límite.">
          <Input id="p-cool" name="cooldownMinutes" type="number" min={0} max={1440} defaultValue={program.cooldown_minutes} required />
        </Field>
      </div>
      <p className="text-xs text-ink-muted">Al guardar, todas las tarjetas se recalculan en el servidor: se emiten las recompensas que ya se alcanzan y se anulan las que dejaron de cumplirse.</p>
      <SubmitButton pendingText="Guardando…">Guardar programa</SubmitButton>
    </form>
  );
}
