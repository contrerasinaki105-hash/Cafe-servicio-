'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const notConfigured = error.message?.includes('Supabase no está configurado');
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center animate-rise">
        <h1 className="text-xl font-semibold tracking-tight">
          {notConfigured ? 'Falta configurar la conexión con Supabase' : 'Algo salió mal'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {notConfigured
            ? 'Define las variables de entorno indicadas en .env.example y reinicia el servidor.'
            : 'No pudimos completar la solicitud. Inténtalo de nuevo en unos segundos.'}
        </p>
        {!notConfigured && <Button className="mt-6" variant="secondary" onClick={reset}>Reintentar</Button>}
      </div>
    </main>
  );
}
