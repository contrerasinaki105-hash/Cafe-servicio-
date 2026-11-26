'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronsUpDown, Gift, LayoutDashboard, LineChart, LogOut, Megaphone, Menu, ScanLine, ScrollText, Settings, Stamp,
  UserCircle, UserCog, Users, X, type LucideIcon,
} from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { signOut } from '@/server/auth-actions';
import { selectBusiness } from '@/server/admin-actions';
import { NAV_SECTIONS } from './nav-config';
import type { StaffRole } from '@/lib/types';

const ICONS: Record<string, LucideIcon> = { LayoutDashboard, ScanLine, Users, Stamp, Gift, Megaphone, LineChart, UserCog, ScrollText, Settings };

interface Props {
  role: StaffRole;
  roleLabel: string;
  userName: string;
  userEmail: string;
  business: { id: string; name: string; logo_url: string | null };
  businesses: { id: string; name: string }[];
}

export function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 text-ink-soft hover:bg-cream-100" aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
        <span className="truncate px-2 text-sm font-semibold">{props.business.name}</span>
        <Link href="/admin/compra" className="-mr-2 rounded-lg p-2 text-[var(--brand)] hover:bg-cream-100" aria-label="Registrar compra">
          <ScanLine className="size-5" />
        </Link>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-espresso-900/40 backdrop-blur-[2px] lg:hidden animate-fade-in" onClick={() => setOpen(false)} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-line bg-cream-50 transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0 shadow-pop' : '-translate-x-full',
        )}
        aria-label="Navegación principal"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <BusinessSwitcher business={props.business} businesses={props.businesses} />
          <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 lg:hidden" aria-label="Cerrar menú">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV_SECTIONS.map((section, i) => {
            const items = section.items.filter((it) => it.roles.includes(props.role));
            if (!items.length) return null;
            return (
              <div key={i} className="mt-4 first:mt-1">
                {section.title && <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{section.title}</p>}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                            active ? 'bg-surface font-medium text-ink shadow-card ring-1 ring-line' : 'text-ink-soft hover:bg-cream-100 hover:text-ink',
                          )}
                        >
                          <Icon className={cn('size-[18px]', active ? 'text-[var(--brand)]' : 'text-ink-muted group-hover:text-ink-soft')} aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <Link
            href="/admin/cuenta"
            className={cn('flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-cream-100', pathname === '/admin/cuenta' && 'bg-cream-100')}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-espresso-900 text-xs font-semibold text-cream-50">
              {initials(props.userName || props.userEmail) || <UserCircle className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{props.userName || props.userEmail}</span>
              <span className="block truncate text-xs text-ink-muted">{props.roleLabel}</span>
            </span>
          </Link>
          <form action={signOut}>
            <button type="submit" className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-cream-100 hover:text-ink">
              <LogOut className="size-[18px] text-ink-muted" aria-hidden /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function BusinessSwitcher({ business, businesses }: Pick<Props, 'business' | 'businesses'>) {
  const [open, setOpen] = useState(false);
  const logo = business.logo_url ? (
    <Image src={business.logo_url} alt="" width={32} height={32} className="size-8 rounded-lg object-cover" />
  ) : (
    <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-xs font-bold text-[var(--brand-contrast)]">{initials(business.name)}</span>
  );
  if (businesses.length <= 1)
    return (
      <div className="flex min-w-0 items-center gap-2.5 px-1">
        {logo}
        <span className="truncate text-sm font-semibold">{business.name}</span>
      </div>
    );
  return (
    <div className="relative min-w-0 flex-1">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-cream-100" aria-expanded={open}>
        {logo}
        <span className="flex-1 truncate text-left text-sm font-semibold">{business.name}</span>
        <ChevronsUpDown className="size-4 text-ink-muted" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-line bg-surface p-1 shadow-pop animate-fade-in">
          {businesses.map((b) => (
            <form key={b.id} action={selectBusiness}>
              <input type="hidden" name="businessId" value={b.id} />
              <button type="submit" className={cn('w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-cream-100', b.id === business.id && 'font-medium')}>
                {b.name}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
