import type { Metadata } from 'next';
import { Sidebar } from '@/components/admin/sidebar';
import { requireStaff, ROLE_LABELS } from '@/lib/auth/staff';
import { readableOn } from '@/lib/utils';

export const metadata: Metadata = { title: { default: 'Panel', template: '%s · Panel' } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Segunda barrera (la primera es el proxy): sesión + membresía activa.
  const ctx = await requireStaff();
  const b = ctx.business;
  return (
    <div
      style={{
        ['--brand' as string]: b.primary_color,
        ['--brand-accent' as string]: b.accent_color,
        ['--brand-contrast' as string]: readableOn(b.primary_color),
      }}
    >
      <Sidebar
        role={ctx.role}
        roleLabel={ROLE_LABELS[ctx.role]}
        userName={ctx.fullName ?? ''}
        userEmail={ctx.email ?? ''}
        business={{ id: b.id, name: b.name, logo_url: b.logo_url }}
        businesses={ctx.memberships.map((m) => ({ id: m.business.id, name: m.business.name }))}
      />
      <main className="lg:pl-[272px]">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
