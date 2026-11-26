'use client';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, Gift, Megaphone, PartyPopper } from 'lucide-react';
import { markNotificationsRead } from '@/server/customer-actions';
import { formatRelative } from '@/lib/utils';
import type { NotificationRow } from '@/lib/types';

const ICON: Record<string, typeof Bell> = { reward_available: Gift, promotion: Megaphone, welcome: PartyPopper, reward_redeemed: Gift };

export function Notifications({ slug, items }: { slug: string; items: NotificationRow[] }) {
  const unread = items.filter((n) => !n.read_at);
  useEffect(() => {
    if (!unread.length) return;
    const reward = unread.find((n) => n.kind === 'reward_available');
    if (reward) toast.success(reward.title, { description: reward.body ?? undefined, duration: 7000 });
    const t = setTimeout(() => markNotificationsRead(slug), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="size-4" /> Notificaciones
        {unread.length > 0 && <span className="tabular rounded-full bg-[var(--brand)] px-1.5 text-[11px] text-[var(--brand-contrast)]">{unread.length}</span>}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((n) => {
          const Icon = ICON[n.kind] ?? Bell;
          return (
            <li key={n.id} className={`flex gap-3 rounded-2xl border px-4 py-3 ${n.read_at ? 'border-line bg-surface' : 'border-[color-mix(in_srgb,var(--brand)_30%,white)] bg-[color-mix(in_srgb,var(--brand)_6%,white)]'}`}>
              <Icon className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-[13px] text-ink-muted">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-ink-muted">{formatRelative(n.created_at)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
