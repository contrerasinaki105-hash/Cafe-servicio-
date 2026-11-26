import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { Gift, Megaphone, ShieldAlert } from 'lucide-react';
import { requireCustomer } from '@/lib/auth/require-customer';
import { createClient } from '@/lib/supabase/server';
import { PortalHeader } from '@/components/portal/portal-header';
import { BottomNav } from '@/components/portal/bottom-nav';
import { LoyaltyCard } from '@/components/portal/loyalty-card';
import { Notifications } from '@/components/portal/notifications';
import { RemoteImage } from '@/components/ui/remote-image';
import { headers } from 'next/headers';
import { formatDate, requestTime } from '@/lib/utils';
import type { NotificationRow, Promotion, Reward } from '@/lib/types';

export const metadata: Metadata = { title: 'Mi tarjeta' };

export default async function CardPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ bienvenida?: string }> }) {
  const { slug } = await params;
  const { bienvenida } = await searchParams;
  const { business, customer } = await requireCustomer(slug);
  const supabase = await createClient();

  const [{ data: card }, { data: rewards }, { data: available }, { data: promotions }, { data: notifications }] = await Promise.all([
    supabase.from('loyalty_cards').select('id, stamp_balance, lifetime_stamps, loyalty_programs!inner(name, stamps_required, is_active)').eq('customer_id', customer.id).eq('loyalty_programs.is_active', true).maybeSingle(),
    supabase.from('rewards').select('*').eq('business_id', business.id).eq('is_active', true).order('stamps_required'),
    supabase.from('reward_redemptions').select('id, code, expires_at, stamps_cost, reward_id').eq('customer_id', customer.id).eq('status', 'available').order('stamps_cost'),
    supabase.from('promotions').select('*').eq('business_id', business.id).order('starts_at', { ascending: false }).limit(5),
    supabase.from('notifications').select('id, kind, title, body, read_at, created_at').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(8),
  ]);

  const program = (Array.isArray(card?.loyalty_programs) ? card?.loyalty_programs[0] : card?.loyalty_programs) as { name: string; stamps_required: number } | undefined;
  const required = program?.stamps_required ?? business.program?.stamps_required ?? 10;
  const balance = card?.stamp_balance ?? 0;
  const rewardList = (rewards ?? []) as Reward[];
  const now = requestTime();
  const activeRewards = rewardList.filter((r) => (!r.valid_until || new Date(r.valid_until).getTime() > now) && (!r.valid_from || new Date(r.valid_from).getTime() <= now));
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const qr = await QRCode.toDataURL(`${origin}/admin/q/${customer.qr_token}`, { width: 480, margin: 1, color: { dark: '#241810', light: '#FFFFFF' } });

  return (
    <>
      <PortalHeader business={business} />
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
        {bienvenida && (
          <p className="mb-4 rounded-2xl bg-success-bg px-4 py-3 text-sm text-success animate-fade-in">¡Listo, {customer.first_name}! Tu tarjeta está activa. Muestra tu código en tu próxima compra.</p>
        )}
        {customer.status === 'blocked' && (
          <p className="mb-4 flex gap-2 rounded-2xl bg-danger-bg px-4 py-3 text-sm text-danger"><ShieldAlert className="size-4 shrink-0" /> Tu tarjeta está suspendida. Consulta con el personal.</p>
        )}

        <LoyaltyCard
          businessName={business.name}
          logoUrl={business.logo_url}
          programName={program?.name ?? 'Tarjeta de fidelidad'}
          customerName={`${customer.first_name} ${customer.last_name}`}
          balance={balance}
          required={required}
          cardId={card?.id ?? customer.id}
        />

        <section className="mt-5 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card animate-rise [animation-delay:100ms]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Tu código QR personal" className="size-28 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="font-medium">Tu código personal</p>
            <p className="mt-1 text-[13px] text-ink-muted">Muéstralo al pagar. El personal registra tu sello; nadie más puede sumarlo.</p>
          </div>
        </section>

        {(available ?? []).length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Gift className="size-4 text-[var(--brand)]" /> Listas para canjear</h2>
            <ul className="mt-3 space-y-2">
              {(available ?? []).map((a) => {
                const r = rewardList.find((x) => x.id === a.reward_id);
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-success/25 bg-success-bg/70 p-4 animate-rise">
                    <Gift className="size-6 shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r?.name ?? 'Recompensa'}</p>
                      <p className="text-xs text-ink-muted">Muestra este código: <span className="font-mono font-semibold text-ink">{a.code}</span>{a.expires_at ? ` · vence ${formatDate(a.expires_at)}` : ''}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {activeRewards.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">Recompensas</h2>
            <ul className="mt-3 space-y-2">
              {activeRewards.map((r) => {
                const pct = Math.min(100, Math.round((balance / r.stamps_required) * 100));
                const left = Math.max(r.stamps_required - balance, 0);
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cream-100">
                      {r.image_url ? <RemoteImage src={r.image_url} alt="" fill className="object-cover" /> : <Gift className="m-auto mt-4 size-6 text-coffee-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <p className="tabular shrink-0 text-xs text-ink-muted">{r.stamps_required} sellos</p>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso hacia ${r.name}`}>
                        <div className="h-full rounded-full bg-[var(--brand)] transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">{left === 0 ? '¡La tienes!' : `Te faltan ${left}`}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(promotions ?? []).length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4 text-[var(--brand)]" /> Promociones vigentes</h2>
            <ul className="mt-3 space-y-2">
              {((promotions ?? []) as Promotion[]).map((p) => (
                <li key={p.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <p className="font-medium">{p.title}{p.discount_percent ? ` · ${p.discount_percent}%` : ''}</p>
                  {p.description && <p className="mt-0.5 text-[13px] text-ink-muted">{p.description}</p>}
                  {p.ends_at && <p className="mt-1 text-xs text-ink-muted">Hasta el {formatDate(p.ends_at)}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <Notifications slug={slug} items={(notifications ?? []) as NotificationRow[]} />
      </main>
      <BottomNav slug={slug} />
    </>
  );
}
