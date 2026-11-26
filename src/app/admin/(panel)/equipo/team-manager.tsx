'use client';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, ShieldCheck, UserPlus } from 'lucide-react';
import { createStaffMember, updateStaffMember } from '@/server/admin-actions';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';
import { Badge } from '@/components/ui/badge';
import { formatDate, initials } from '@/lib/utils';
import type { StaffRole } from '@/lib/types';

export interface TeamMember {
  membershipId: string;
  userId: string;
  role: StaffRole;
  isActive: boolean;
  email: string | null;
  displayName: string;
  position: string | null;
  phone: string | null;
  createdAt: string;
  isMe: boolean;
}

const ROLE: Record<StaffRole, { label: string; tone: 'brand' | 'info' | 'neutral' }> = {
  owner: { label: 'Administrador principal', tone: 'brand' },
  manager: { label: 'Gerente', tone: 'info' },
  employee: { label: 'Empleado', tone: 'neutral' },
};

export function TeamManager({ members, timezone }: { members: TeamMember[]; timezone: string }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="brand" onClick={() => setCreating(true)}><UserPlus className="size-4" /> Agregar persona</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.membershipId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream-100 text-sm font-semibold text-coffee-600">{initials(m.displayName)}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {m.displayName} {m.isMe && <span className="text-xs font-normal text-ink-muted">(tú)</span>}
                  <Badge tone={ROLE[m.role].tone}>{ROLE[m.role].label}</Badge>
                  {!m.isActive && <Badge tone="danger">Desactivado</Badge>}
                </p>
                <p className="truncate text-sm text-ink-muted">{m.email}{m.position ? ` · ${m.position}` : ''} · desde {formatDate(m.createdAt, timezone)}</p>
              </div>
              {m.role !== 'owner' && !m.isMe && (
                <Button size="sm" variant="secondary" onClick={() => setEditing(m)}><Pencil className="size-3.5" /> Editar</Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        {[
          { r: 'Administrador principal', d: 'Acceso completo: equipo, recompensas, configuración, auditoría.' },
          { r: 'Gerente', d: 'Clientes, estadísticas, promociones, correcciones y autorizaciones.' },
          { r: 'Empleado', d: 'Buscar clientes, registrar compras, agregar sellos y confirmar canjes.' },
        ].map((x) => (
          <div key={x.r} className="rounded-xl border border-line bg-cream-50 p-3">
            <p className="flex items-center gap-1.5 font-medium"><ShieldCheck className="size-4 text-coffee-500" /> {x.r}</p>
            <p className="mt-1 text-xs text-ink-muted">{x.d}</p>
          </div>
        ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Agregar persona al equipo" description="Cada persona tiene sus propias credenciales.">
        {creating && <CreateForm onDone={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar acceso">
        {editing && <EditForm member={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(createStaffMember, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message, { duration: 8000 });
      onDone();
    }
  }, [state, onDone]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" autoComplete="off">
      {state && !state.ok && <FormMessage state={state} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" htmlFor="s-name" error={fe?.displayName}><Input id="s-name" name="displayName" required /></Field>
        <Field label="Rol" htmlFor="s-role">
          <Select id="s-role" name="role" defaultValue="employee">
            <option value="employee">Empleado</option>
            <option value="manager">Gerente</option>
          </Select>
        </Field>
      </div>
      <Field label="Correo electrónico (usuario)" htmlFor="s-email" error={fe?.email}><Input id="s-email" name="email" type="email" required autoComplete="off" /></Field>
      <Field label="Contraseña inicial" htmlFor="s-pass" error={fe?.password} hint="Mínimo 8 caracteres con letras y números. Compártela en privado.">
        <Input id="s-pass" name="password" type="text" required autoComplete="new-password" minLength={8} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Puesto" htmlFor="s-pos" optional><Input id="s-pos" name="position" placeholder="Barista" /></Field>
        <Field label="Teléfono" htmlFor="s-phone" optional><Input id="s-phone" name="phone" type="tel" /></Field>
      </div>
      <SubmitButton className="w-full" pendingText="Creando cuenta…">Crear acceso</SubmitButton>
    </form>
  );
}

function EditForm({ member, onDone }: { member: TeamMember; onDone: () => void }) {
  const [state, action] = useActionState(updateStaffMember.bind(null, member.membershipId), null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <FormMessage state={state} />}
      <p className="text-sm text-ink-muted">{member.email}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="es-name"><Input id="es-name" name="displayName" defaultValue={member.displayName} required /></Field>
        <Field label="Rol" htmlFor="es-role">
          <Select id="es-role" name="role" defaultValue={member.role}>
            <option value="employee">Empleado</option>
            <option value="manager">Gerente</option>
          </Select>
        </Field>
        <Field label="Puesto" htmlFor="es-pos" optional><Input id="es-pos" name="position" defaultValue={member.position ?? ''} /></Field>
        <Field label="Teléfono" htmlFor="es-phone" optional><Input id="es-phone" name="phone" defaultValue={member.phone ?? ''} /></Field>
      </div>
      <Checkbox id="es-active" name="isActive" defaultChecked={member.isActive} label="Acceso activo" description="Al desactivarlo, la persona pierde el acceso de inmediato. Su historial se conserva." />
      <SubmitButton className="w-full" pendingText="Guardando…">Guardar</SubmitButton>
    </form>
  );
}
