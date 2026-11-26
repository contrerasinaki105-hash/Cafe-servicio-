'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { KeyRound, Pencil, SlidersHorizontal } from 'lucide-react';
import { adjustStamps, resetCustomerPassword, updateCustomer } from '@/server/admin-actions';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';
import type { CustomerOverview } from '@/lib/types';

export function CustomerActions({ customer, notes }: { customer: CustomerOverview; notes: string | null }) {
  const [modal, setModal] = useState<'edit' | 'adjust' | 'password' | null>(null);
  return (
    <>
      <Button variant="secondary" onClick={() => setModal('adjust')}><SlidersHorizontal className="size-4" /> Corregir sellos</Button>
      <Button variant="secondary" onClick={() => setModal('edit')}><Pencil className="size-4" /> Editar</Button>
      {customer.user_id && <Button variant="ghost" onClick={() => setModal('password')}><KeyRound className="size-4" /> Contraseña</Button>}

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Editar cliente">
        {modal === 'edit' && <EditForm customer={customer} notes={notes} onDone={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === 'adjust'} onClose={() => setModal(null)} title="Corregir sellos" description="Operación autorizada: queda registrada con tu nombre, fecha y motivo.">
        {modal === 'adjust' && <AdjustForm customer={customer} onDone={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === 'password'} onClose={() => setModal(null)} title="Restablecer contraseña del cliente" size="sm">
        {modal === 'password' && <PasswordReset customerId={customer.id} />}
      </Modal>
    </>
  );
}

function EditForm({ customer, notes, onDone }: { customer: CustomerOverview; notes: string | null; onDone: () => void }) {
  const [state, action] = useActionState(updateCustomer.bind(null, customer.id), null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <FormMessage state={state} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="e-first"><Input id="e-first" name="firstName" defaultValue={customer.first_name} required /></Field>
        <Field label="Apellido" htmlFor="e-last"><Input id="e-last" name="lastName" defaultValue={customer.last_name} required /></Field>
      </div>
      <Field label="Correo electrónico" htmlFor="e-email" optional><Input id="e-email" name="email" type="email" defaultValue={customer.email ?? ''} /></Field>
      <Field label="Estado" htmlFor="e-status" hint="Un cliente bloqueado no puede acumular sellos ni canjear.">
        <Select id="e-status" name="status" defaultValue={customer.status}>
          <option value="active">Activo</option>
          <option value="blocked">Bloqueado</option>
        </Select>
      </Field>
      <Field label="Notas internas" htmlFor="e-notes" optional><Textarea id="e-notes" name="notes" defaultValue={notes ?? ''} maxLength={1000} /></Field>
      <p className="text-xs text-ink-muted">El teléfono identifica al cliente y no se puede cambiar desde aquí.</p>
      <SubmitButton className="w-full" pendingText="Guardando…">Guardar cambios</SubmitButton>
    </form>
  );
}

function AdjustForm({ customer, onDone }: { customer: CustomerOverview; onDone: () => void }) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(qty);
        if (!Number.isInteger(n) || n < 1) return setError('Indica una cantidad válida.');
        start(async () => {
          const res = await adjustStamps(customer.id, mode === 'add' ? n : -n, note);
          if (!res.ok) setError(res.error);
          else {
            toast.success(res.message);
            onDone();
          }
        });
      }}
    >
      {error && <FormMessage state={{ ok: false, error }} />}
      <p className="text-sm text-ink-soft">Saldo actual: <strong className="tabular text-ink">{customer.stamp_balance} sellos</strong></p>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-cream-100 p-1">
        {(['add', 'remove'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg py-2 text-sm font-medium ${mode === m ? 'bg-surface shadow-card' : 'text-ink-muted'}`}>
            {m === 'add' ? 'Agregar' : 'Quitar'}
          </button>
        ))}
      </div>
      <Field label="Cantidad de sellos" htmlFor="adj-qty"><Input id="adj-qty" type="number" min={1} max={100} value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>
      <Field label="Motivo" htmlFor="adj-note" hint="Obligatorio. Ej.: sello no registrado el 12/05, migración de tarjeta física.">
        <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} maxLength={280} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>Registrar corrección</Button>
    </form>
  );
}

function PasswordReset({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  if (result)
    return (
      <div className="space-y-3 text-sm">
        <p className="text-ink-soft">Contraseña temporal (se muestra una sola vez). Entrégala al cliente en persona y pídele que la cambie:</p>
        <p className="rounded-xl bg-cream-100 px-4 py-3 text-center font-mono text-lg tracking-wider">{result}</p>
      </div>
    );
  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink-soft">Usa esta opción solo si el cliente está presente y verificaste su identidad. La acción queda registrada.</p>
      <Button
        className="w-full"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await resetCustomerPassword(customerId);
            if (res.ok && res.data) setResult(res.data.password);
            else toast.error(res.ok ? 'Error' : res.error);
          })
        }
      >
        Generar contraseña temporal
      </Button>
    </div>
  );
}
