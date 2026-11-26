'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, History, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/c/${slug}/tarjeta`, label: 'Tarjeta', icon: CreditCard },
    { href: `/c/${slug}/historial`, label: 'Historial', icon: History },
    { href: `/c/${slug}/perfil`, label: 'Perfil', icon: UserRound },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Navegación">
      <ul className="mx-auto grid max-w-lg grid-cols-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? 'page' : undefined} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', active ? 'text-[var(--brand)]' : 'text-ink-muted')}>
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
