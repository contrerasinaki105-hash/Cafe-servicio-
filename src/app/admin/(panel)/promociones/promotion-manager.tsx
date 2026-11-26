'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Megaphone, Pencil, Plus, Send } from 'lucide-react';
import { savePromotion, sendPromotion } from '@/server/admin-actions';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormMessage } from '@/components/ui/form-message';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PROMOTION_KINDS, SEGMENTS } from '@/lib/labels';
import { formatDate } from '@/lib/utils';
import type { Promotion } from '@/lib/types';

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function PromotionManager({ promotions, timezone, segmentCounts, now }: { promotions: Promotion[]; timezone: string; segmentCounts: Record<string, number>; now: number }) {
  const [editing, setEditing] = useState<Promotion | 'new' | null>(null);
  const [sending, setSending] = useState<Promotion | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="brand" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva promoción</Button>
      </div>
      {promotions.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState icon={Megaphone} title="Sin promociones" description="Crea descuentos, beneficios para clientes frecuentes o campañas para recuperar clientes inactivos." />
        </div>
      ) : (
        <div className="space-y-3">
          {promotions.map((p) => {
            const ended = p.ends_at && new Date(p.ends_at).getTime() < now;
            const live = p.is_active && !ended && new Date(p.starts_at).getTime() <= now;
            return (
              <article key={p.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center animate-rise">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{p.title}</h3>
                    {live ? <Badge tone="success" dot>Vigente</Badge> : ended ? <Badge tone="neutral">Finalizada</Badge> : !p.is_active ? <Badge>Inactiva</Badge> : <Badge tone="info">Programada</Badge>}
                    <Badge tone="brand">{PROMOTION_KINDS[p.kind]}</Badge>
                  </div>
                  {p.description && <p className="mt-1 text-sm text-ink-muted">{p.description}</p>}
                  <p className="mt-2 text-xs text-ink-muted">
                    {SEGMENTS[p.segment]}
                    {p.discount_percent ? ` · ${p.discount_percent}% de descuento` : ''}
                    {p.bonus_stamps ? ` · +${p.bonus_stamps} sellos de regalo` : ''}
                    {` · ${formatDate(p.starts_at, timezone)} – ${p.ends_at ? formatDate(p.ends_at, timezone) : 'sin fin'}`}
                  </p>
                  {p.last_sent_at && <p className="mt-1 text-xs text-success">Enviada el {formatDate(p.last_sent_at, timezone, true)} a {p.recipients_count} clientes</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(p)}><Pencil className="size-3.5" /> Editar</Button>
                  {!p.last_sent_at && live && <Button size="sm" variant="primary" onClick={() => setSending(p)}><Send className="size-3.5" /> Enviar</Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nueva promoción' : 'Editar promoción'} size="lg">
        {editing && <PromotionForm promotion={editing === 'new' ? null : editing} onDone={() => setEditing(null)} segmentCounts={segmentCounts} />}
      </Modal>

      <Modal open={!!sending} onClose={() => setSending(null)} title="Enviar campaña" size="sm">
        {sending && (
          <>
            <div className="space-y-2 text-sm text-ink-soft">
              <p>Se enviará <strong className="text-ink">{sending.title}</strong> a: {SEGMENTS[sending.segment]}.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Solo reciben el aviso los clientes que <strong>aceptaron promociones</strong>.</li>
                {sending.bonus_stamps && <li>Todos los clientes del segmento recibirán +{sending.bonus_stamps} sellos (una sola vez).</li>}
                <li>Notificación en la tarjeta digital: inmediata.</li>
                <li>Correo electrónico y WhatsApp: quedan en cola hasta conectar un proveedor.</li>
              </ul>
              <p className="text-xs text-ink-muted">Una campaña solo puede enviarse una vez.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSending(null)}>Cancelar</Button>
              <Button
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const res = await sendPromotion(sending.id);
                    setSending(null);
                    if (res.ok) toast.success(res.message);
                    else toast.error(res.error);
                  })
                }
              >
                <Send className="size-4" /> Enviar ahora
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function PromotionForm({ promotion, onDone, segmentCounts }: { promotion: Promotion | null; onDone: () => void; segmentCounts: Record<string, number> }) {
  const [state, action] = useActionState(savePromotion, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const sent = Boolean(promotion?.last_sent_at);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <FormMessage state={state} />}
      <input type="hidden" name="id" value={promotion?.id ?? ''} />
      <Field label="Título" htmlFor="pr-title" error={fe?.title}><Input id="pr-title" name="title" defaultValue={promotion?.title} required placeholder="Martes de doble sello" /></Field>
      <Field label="Mensaje para el cliente" htmlFor="pr-desc" optional><Textarea id="pr-desc" name="description" defaultValue={promotion?.description ?? ''} maxLength={500} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" htmlFor="pr-kind">
          <Select id="pr-kind" name="kind" defaultValue={promotion?.kind ?? 'discount'}>
            {Object.entries(PROMOTION_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Dirigida a" htmlFor="pr-seg">
          <Select id="pr-seg" name="segment" defaultValue={promotion?.segment ?? 'all'} disabled={sent}>
            {Object.entries(SEGMENTS).map(([k, v]) => <option key={k} value={k}>{v}{segmentCounts[k] !== undefined ? ` (${segmentCounts[k]})` : ''}</option>)}
          </Select>
        </Field>
        <Field label="Descuento (%)" htmlFor="pr-disc" optional error={fe?.discountPercent}><Input id="pr-disc" name="discountPercent" type="number" min={1} max={100} defaultValue={promotion?.discount_percent ?? ''} /></Field>
        <Field label="Sellos de regalo" htmlFor="pr-bonus" optional hint={sent ? 'Ya otorgados.' : 'Se acreditan al enviar la campaña.'} error={fe?.bonusStamps}>
          <Input id="pr-bonus" name="bonusStamps" type="number" min={1} max={20} defaultValue={promotion?.bonus_stamps ?? ''} disabled={sent} />
        </Field>
        <Field label="Inicio" htmlFor="pr-start" optional><Input id="pr-start" name="startsAt" type="datetime-local" defaultValue={toLocalInput(promotion?.starts_at ?? null)} /></Field>
        <Field label="Fin" htmlFor="pr-end" optional error={fe?.endsAt}><Input id="pr-end" name="endsAt" type="datetime-local" defaultValue={toLocalInput(promotion?.ends_at ?? null)} /></Field>
      </div>
      {sent && <input type="hidden" name="segment" value={promotion!.segment} />}
      <Checkbox id="pr-active" name="isActive" label="Promoción activa" defaultChecked={promotion ? promotion.is_active : true} description="Las promociones vigentes se muestran en la tarjeta digital de los clientes." />
      <SubmitButton className="w-full" pendingText="Guardando…">{promotion ? 'Guardar cambios' : 'Crear promoción'}</SubmitButton>
    </form>
  );
}
