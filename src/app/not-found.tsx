import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import { WebyaMark } from '@/components/brand/logo';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="text-center animate-rise">
        <WebyaMark className="mx-auto size-10" />
        <p className="mt-6 text-sm font-medium text-coffee-500">Error 404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">No encontramos esta página</h1>
        <p className="mt-2 text-sm text-ink-muted">Revisa la dirección o vuelve al inicio.</p>
        <Link href="/" className={buttonClasses('secondary', 'md', 'mt-6')}>Ir al inicio</Link>
      </div>
    </main>
  );
}
