import { ShieldAlert } from 'lucide-react';
import { signOut } from '@/server/auth-actions';
import { Button } from '@/components/ui/button';

export default function NoAccessPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center animate-rise">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger-bg text-danger"><ShieldAlert className="size-6" /></div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Acceso no autorizado</h1>
        <p className="mt-2 text-sm text-ink-muted">Tu cuenta no tiene permisos en ningún establecimiento activo. Si crees que es un error, contacta al administrador de tu negocio.</p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="secondary">Cerrar sesión</Button>
        </form>
      </div>
    </main>
  );
}
