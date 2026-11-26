'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, Gift, Minus, Plus, QrCode, Search, ShieldCheck, Stamp, UserPlus, X } from 'lucide-react';
import { getCustomerForCounter, redeemReward, registerPurchase, searchCustomers } from '@/server/admin-actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QrScanner } from '@/components/admin/qr-scanner';
import { NewCustomerForm } from '@/components/admin/new-customer-form';
import { cn, formatDate, formatMoney, formatRelative } from '@/lib/utils';
import { formatPhone } from '@/lib/phone';
import type { CustomerOverview, StaffRole } from '@/lib/types';

type CounterData = NonNullable<Awaited<ReturnType<typeof getCustomerForCounter>>>;

interface Props {
  role: StaffRole;
  maxStamps: number;
  stampsRequired: number;
  currency: string;
  timezone: string;
}

export function Counter({ role, maxStamps, stampsRequired, currency, timezone }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerOverview[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CounterData | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const isManager = role !== 'employee';
  const limit = isManager ? 20 : maxStamps;

  // Búsqueda con espera breve mientras se escribe
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      const res = await searchCustomers(q);
      setSearching(false);
      if (res.ok) setResults(res.data ?? []);
      else toast.error(res.error);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const openCustomer = useCallback(async (id: string) => {
    setLoadingCustomer(true);
    const data = await getCustomerForCounter(id);
    setLoadingCustomer(false);
    if (!data) {
      toast.error('No encontramos al cliente.');
      return;
    }
    setSelected(data);
    setResults(null);
    setQuery('');
  }, []);

  const onScan = useCallback(
    async (text: string) => {
      setScanOpen(false);
      const res = await searchCustomers(text);
      if (res.ok && res.data?.length === 1) openCustomer(res.data[0].id);
      else toast.error('Código no reconocido en este negocio.');
    },
    [openCustomer],
  );

  const reset = () => {
    setSelected(null);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        {/* Buscador */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <label htmlFor="customer-search" className="text-[13px] font-medium">Buscar cliente</label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input
                ref={searchRef}
                id="customer-search"
                autoFocus
                autoComplete="off"
                placeholder="Teléfono, nombre o código"
                className="h-12 pl-10 text-base"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  const long = e.target.value.trim().length >= 2;
                  setSearching(long);
                  if (!long) setResults(null);
                }}
              />
            </div>
            <Button variant="secondary" size="lg" onClick={() => setScanOpen(true)} aria-label="Escanear código QR">
              <QrCode className="size-5" /> <span className="hidden sm:inline">Escanear</span>
            </Button>
          </div>

          {(searching || results) && (
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              {searching && !results ? (
                <div className="space-y-2 p-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
              ) : results && results.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-6 text-center text-sm text-ink-muted">
                  No hay clientes que coincidan con «{query}».
                  <Button size="sm" variant="secondary" onClick={() => setNewOpen(true)}><UserPlus className="size-4" /> Registrar nuevo cliente</Button>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {results?.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => openCustomer(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.full_name}</span>
                          <span className="block text-xs text-ink-muted">{formatPhone(c.phone)} · última visita {formatRelative(c.last_visit_at).toLowerCase()}</span>
                        </span>
                        <span className="tabular text-sm text-ink-soft">{c.stamp_balance} <Stamp className="inline size-3.5" aria-label="sellos" /></span>
                        {c.available_rewards > 0 && <Badge tone="success">{c.available_rewards} premio</Badge>}
                        {c.status === 'blocked' && <Badge tone="danger">Bloqueado</Badge>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {loadingCustomer && <Skeleton className="h-64" />}

        {!loadingCustomer && selected && (
          <CustomerPanel
            key={selected.customer.id}
            data={selected}
            stampsRequired={stampsRequired}
            limit={limit}
            isManager={isManager}
            currency={currency}
            timezone={timezone}
            onRefresh={() => openCustomer(selected.customer.id)}
            onClose={reset}
          />
        )}

        {!loadingCustomer && !selected && (
          <div className="rounded-2xl border border-dashed border-line-strong bg-cream-50 px-6 py-12 text-center">
            <p className="text-sm font-medium">Busca o escanea a un cliente para registrar su compra</p>
            <p className="mt-1 text-sm text-ink-muted">Pide su teléfono o su código QR de la tarjeta digital.</p>
            <Button className="mt-5" variant="secondary" onClick={() => setNewOpen(true)}><UserPlus className="size-4" /> Nuevo cliente</Button>
          </div>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-10 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card">
          <p className="font-semibold">Cómo registrar en 3 pasos</p>
          <ol className="mt-3 space-y-3 text-ink-soft">
            <li className="flex gap-3"><Step n={1} /> Busca por teléfono o escanea el QR.</li>
            <li className="flex gap-3"><Step n={2} /> Revisa sellos y premios disponibles.</li>
            <li className="flex gap-3"><Step n={3} /> Confirma la compra. El sello queda registrado a tu nombre.</li>
          </ol>
          <div className="mt-5 rounded-xl bg-cream-100 p-3 text-xs text-ink-soft">
            <ShieldCheck className="mb-1 size-4 text-coffee-600" />
            Cada operación tiene un identificador único: aunque toques dos veces, el sello no se duplica.
            {!isManager && ` Puedes dar hasta ${maxStamps} ${maxStamps === 1 ? 'sello' : 'sellos'} por compra.`}
          </div>
        </div>
      </aside>

      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Escanear tarjeta" size="sm">
        {scanOpen && <QrScanner onResult={onScan} />}
      </Modal>
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nuevo cliente" description="Regístralo en mostrador; después podrá activar su cuenta con su teléfono.">
        {newOpen && (
          <NewCustomerForm
            defaultPhone={/\d{6,}/.test(query) ? query : undefined}
            onCreated={(id) => {
              setNewOpen(false);
              openCustomer(id);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-espresso-900 text-[11px] font-semibold text-cream-50">{n}</span>;
}

function CustomerPanel({
  data, stampsRequired, limit, isManager, currency, timezone, onRefresh, onClose,
}: {
  data: CounterData;
  stampsRequired: number;
  limit: number;
  isManager: boolean;
  currency: string;
  timezone: string;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const c = data.customer;
  const [stamps, setStamps] = useState(1);
  const [amount, setAmount] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [cooldown, setCooldown] = useState(false);
  const [redeemId, setRedeemId] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ balance: number; rewards: number } | null>(null);

  const submit = (override = false) =>
    start(async () => {
      const res = await registerPurchase({ customerId: c.id, stamps, amount, idempotencyKey: key, overrideCooldown: override });
      if (!res.ok) {
        if (/hace unos minutos/.test(res.error)) setCooldown(true);
        toast.error(res.error);
        return;
      }
      setCooldown(false);
      setKey(crypto.randomUUID());
      setAmount('');
      setStamps(1);
      setSuccess({ balance: res.data!.stamp_balance, rewards: res.data!.new_rewards });
      if (res.data!.duplicate) toast.info(res.message);
      else toast.success(res.data!.new_rewards ? '¡Compra registrada y recompensa desbloqueada!' : 'Compra registrada');
      onRefresh();
    });

  const redeem = (id: string) =>
    start(async () => {
      const res = await redeemReward(id);
      setRedeemId(null);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.message);
        onRefresh();
      }
    });

  const progress = Math.min(c.stamp_balance, stampsRequired);
  const blocked = c.status === 'blocked';
  const redeemTarget = data.rewards.find((r) => r.id === redeemId);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card animate-rise">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{c.full_name}</h2>
            {blocked ? <Badge tone="danger">Bloqueado</Badge> : c.user_id ? <Badge tone="success" dot>Tarjeta digital</Badge> : <Badge>Registro en mostrador</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">
            {formatPhone(c.phone)} · {c.visits_count} visitas · <Link href={`/admin/clientes/${c.id}`} className="text-coffee-600 hover:underline">ver perfil</Link>
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100" aria-label="Cerrar cliente"><X className="size-4" /></button>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div>
          <p className="text-[13px] font-medium text-ink-muted">Sellos acumulados</p>
          <p className="tabular mt-1 text-4xl font-semibold tracking-tight">{c.stamp_balance}<span className="text-lg font-normal text-ink-muted"> / {stampsRequired}</span></p>
          <div className="mt-3 grid grid-cols-10 gap-1.5" aria-hidden>
            {Array.from({ length: stampsRequired }).map((_, i) => (
              <span key={i} className={cn('aspect-square rounded-full border', i < progress ? 'border-transparent bg-[var(--brand)]' : 'border-line-strong bg-cream-50')} />
            ))}
          </div>
          {success && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-success animate-fade-in">
              <Check className="size-4" /> Registrado. Saldo: {success.balance} sellos{success.rewards ? ` · ${success.rewards} recompensa nueva` : ''}.
            </p>
          )}

          <p className="mt-6 text-[13px] font-medium text-ink-muted">Recompensas disponibles</p>
          {data.rewards.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Ninguna por ahora.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {data.rewards.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-success/25 bg-success-bg/60 px-3 py-2.5">
                  <Gift className="size-5 shrink-0 text-success" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block font-mono text-[11px] text-ink-muted">Código {r.code}{r.expires_at ? ` · vence ${formatDate(r.expires_at, timezone)}` : ''}</span>
                  </span>
                  <Button size="sm" variant="secondary" disabled={blocked || pending} onClick={() => setRedeemId(r.id)}>Canjear</Button>
                </li>
              ))}
            </ul>
          )}

          {data.visits.length > 0 && (
            <>
              <p className="mt-6 text-[13px] font-medium text-ink-muted">Últimas visitas</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {data.visits.map((v) => (
                  <li key={v.id} className="flex justify-between">
                    <span>{formatDate(v.created_at, timezone, true)}</span>
                    <span className="tabular">+{v.stamps_awarded}{v.amount !== null ? ` · ${formatMoney(v.amount, currency)}` : ''}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <form
          className="space-y-4 rounded-2xl bg-cream-50 p-4 ring-1 ring-line"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <p className="text-sm font-semibold">Registrar compra</p>
          <div>
            <span className="text-[13px] font-medium">Sellos</span>
            <div className="mt-1.5 flex items-center gap-3">
              <Button type="button" variant="secondary" size="lg" className="w-12 px-0" onClick={() => setStamps((s) => Math.max(1, s - 1))} disabled={stamps <= 1} aria-label="Menos sellos"><Minus className="size-4" /></Button>
              <output className="tabular w-10 text-center text-2xl font-semibold" aria-live="polite">{stamps}</output>
              <Button type="button" variant="secondary" size="lg" className="w-12 px-0" onClick={() => setStamps((s) => Math.min(limit, s + 1))} disabled={stamps >= limit} aria-label="Más sellos"><Plus className="size-4" /></Button>
            </div>
            <p className="mt-1 text-xs text-ink-muted">Máximo {limit} por compra{isManager ? ' (gerente)' : ''}.</p>
          </div>
          <Field label="Importe de la compra" htmlFor="amount" optional hint={`En ${currency}. Sirve para calcular el gasto por cliente.`}>
            <Input id="amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Button type="submit" variant="brand" size="lg" className="w-full" loading={pending} disabled={blocked}>
            <Stamp className="size-4" /> Confirmar compra (+{stamps})
          </Button>
          {cooldown && isManager && (
            <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={() => submit(true)}>
              <ShieldCheck className="size-4" /> Autorizar compra adicional
            </Button>
          )}
          {blocked && <p className="text-xs text-danger">Cliente bloqueado: no puede acumular sellos.</p>}
        </form>
      </div>

      <Modal open={!!redeemId} onClose={() => setRedeemId(null)} title="Confirmar canje" size="sm">
        <p className="text-sm text-ink-soft">
          Vas a entregar <strong className="text-ink">{redeemTarget?.name}</strong> a {c.first_name}. Se descontarán {redeemTarget?.stamps_cost} sellos. Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRedeemId(null)}>Cancelar</Button>
          <Button variant="brand" loading={pending} onClick={() => redeemId && redeem(redeemId)}>Confirmar canje</Button>
        </div>
      </Modal>
    </div>
  );
}
