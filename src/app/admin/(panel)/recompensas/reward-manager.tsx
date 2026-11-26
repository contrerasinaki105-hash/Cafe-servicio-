'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Gift, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteReward, saveReward } from '@/server/admin-actions';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RemoteImage } from '@/components/ui/remote-image';
import { formatDate } from '@/lib/utils';
import type { Reward } from '@/lib/types';

type RewardWithStats = Reward & { redeemed: number; available: number; isBase: boolean };

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

export function RewardManager({ rewards, canEdit, timezone, now }: { rewards: RewardWithStats[]; canEdit: boolean; timezone: string; now: number }) {
  const [editing, setEditing] = useState<RewardWithStats | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<RewardWithStats | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <Button variant="brand" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva recompensa</Button>
        </div>
      )}
      {rewards.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface"><EmptyState icon={Gift} title="Sin recompensas" description="Crea la primera recompensa para tus clientes." /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rewards.map((r) => {
            const ended = r.valid_until && new Date(r.valid_until).getTime() < now;
            const upcoming = r.valid_from && new Date(r.valid_from).getTime() > now;
            return (
              <article key={r.id} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card animate-rise">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-cream-100 to-cream-200">
                  {r.image_url ? (
                    <RemoteImage src={r.image_url} alt={r.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                  ) : (
                    <div className="grid h-full place-items-center text-coffee-500"><Gift className="size-10 opacity-60" /></div>
                  )}
                  <span className="tabular absolute left-3 top-3 rounded-full bg-espresso-900/85 px-2.5 py-1 text-xs font-semibold text-cream-50 backdrop-blur">{r.stamps_required} sellos</span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{r.name}</h3>
                    {!r.is_active ? <Badge>Inactiva</Badge> : ended ? <Badge tone="danger">Vencida</Badge> : upcoming ? <Badge tone="info">Programada</Badge> : <Badge tone="success" dot>Activa</Badge>}
                  </div>
                  {r.description && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{r.description}</p>}
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-cream-50 px-2.5 py-2"><dt className="text-ink-muted">Canjeadas</dt><dd className="tabular font-semibold">{r.redeemed}{r.max_total_redemptions ? ` / ${r.max_total_redemptions}` : ''}</dd></div>
                    <div className="rounded-lg bg-cream-50 px-2.5 py-2"><dt className="text-ink-muted">Disponibles</dt><dd className="tabular font-semibold">{r.available}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs text-ink-muted">
                    {r.valid_from || r.valid_until ? `Vigencia: ${r.valid_from ? formatDate(r.valid_from, timezone) : 'hoy'} – ${r.valid_until ? formatDate(r.valid_until, timezone) : 'sin fin'}` : 'Sin fecha de vencimiento'}
                    {r.max_redemptions_per_customer ? ` · máx. ${r.max_redemptions_per_customer} por cliente` : ''}
                    {r.isBase ? ' · Recompensa principal' : ''}
                  </p>
                  {canEdit && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(r)}><Pencil className="size-3.5" /> Editar</Button>
                      {!r.isBase && <Button size="sm" variant="ghost" onClick={() => setToDelete(r)}><Trash2 className="size-3.5" /> Eliminar</Button>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nueva recompensa' : 'Editar recompensa'} size="lg">
        {editing && <RewardForm reward={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar recompensa" size="sm">
        <p className="text-sm text-ink-soft">
          ¿Eliminar <strong className="text-ink">{toDelete?.name}</strong>? Las recompensas pendientes de canje se anularán. Si ya tiene canjes en el historial, se desactivará para conservar la trazabilidad.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteReward(toDelete!.id);
                setToDelete(null);
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </>
  );
}

function RewardForm({ reward, onDone }: { reward: RewardWithStats | null; onDone: () => void }) {
  const [state, action] = useActionState(saveReward, null);
  const [preview, setPreview] = useState<string | null>(reward?.image_url ?? null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <FormMessage state={state} />}
      <input type="hidden" name="id" value={reward?.id ?? ''} />
      <input type="hidden" name="currentImage" value={reward?.image_url ?? ''} />
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Nombre" htmlFor="r-name" error={fe?.name}><Input id="r-name" name="name" defaultValue={reward?.name} required placeholder="Postre gratis" /></Field>
        <Field label="Sellos necesarios" htmlFor="r-stamps" error={fe?.stampsRequired}><Input id="r-stamps" name="stampsRequired" type="number" min={1} max={500} defaultValue={reward?.stamps_required ?? 10} required /></Field>
      </div>
      <Field label="Descripción" htmlFor="r-desc" optional><Textarea id="r-desc" name="description" defaultValue={reward?.description ?? ''} maxLength={280} /></Field>

      <Field label="Fotografía" htmlFor="r-image" optional hint="PNG, JPG o WEBP · máx. 2 MB.">
        <div className="flex items-center gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-cream-100">
            {preview ? <RemoteImage src={preview} alt="" fill className="object-cover" /> : <ImagePlus className="m-auto mt-7 size-6 text-ink-muted" />}
          </div>
          <input
            id="r-image"
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cream-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
        </div>
      </Field>
      {reward?.image_url && <Checkbox id="r-remove" name="removeImage" label="Quitar la fotografía actual" />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Disponible desde" htmlFor="r-from" optional><Input id="r-from" name="validFrom" type="datetime-local" defaultValue={toLocalInput(reward?.valid_from ?? null)} /></Field>
        <Field label="Fecha de vencimiento" htmlFor="r-until" optional error={fe?.validUntil}><Input id="r-until" name="validUntil" type="datetime-local" defaultValue={toLocalInput(reward?.valid_until ?? null)} /></Field>
        <Field label="Límite de canjes por cliente" htmlFor="r-maxc" optional><Input id="r-maxc" name="maxPerCustomer" type="number" min={1} defaultValue={reward?.max_redemptions_per_customer ?? ''} placeholder="Sin límite" /></Field>
        <Field label="Límite total de canjes" htmlFor="r-maxt" optional><Input id="r-maxt" name="maxTotal" type="number" min={1} defaultValue={reward?.max_total_redemptions ?? ''} placeholder="Sin límite" /></Field>
      </div>
      <Checkbox id="r-active" name="isActive" label="Recompensa activa" defaultChecked={reward ? reward.is_active : true} description="Los clientes que alcancen los sellos la recibirán automáticamente." />
      <SubmitButton className="w-full" pendingText="Guardando…">{reward ? 'Guardar cambios' : 'Crear recompensa'}</SubmitButton>
    </form>
  );
}
