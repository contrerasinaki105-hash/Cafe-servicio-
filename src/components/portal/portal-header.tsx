import Link from 'next/link';
import { RemoteImage } from '@/components/ui/remote-image';
import { initials } from '@/lib/utils';
import type { PublicBusiness } from '@/lib/types';

export function PortalHeader({ business, right }: { business: PublicBusiness; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <Link href={`/c/${business.slug}`} className="flex min-w-0 items-center gap-2.5">
          {business.logo_url ? (
            <span className="relative size-8 overflow-hidden rounded-lg"><RemoteImage src={business.logo_url} alt="" fill className="object-cover" /></span>
          ) : (
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-xs font-bold text-[var(--brand-contrast)]">{initials(business.name)}</span>
          )}
          <span className="truncate text-[15px] font-semibold">{business.name}</span>
        </Link>
        {right}
      </div>
    </header>
  );
}
