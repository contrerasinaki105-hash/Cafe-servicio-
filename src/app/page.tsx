import Link from 'next/link';
import { BarChart3, QrCode, ShieldCheck, Stamp, Store, Users } from 'lucide-react';
import { WebyaLogo } from '@/components/brand/logo';
import { buttonClasses } from '@/components/ui/button';

const FEATURES = [
  { icon: QrCode, title: 'Registro por QR', text: 'Tus clientes crean su tarjeta digital en segundos, sin descargar apps.' },
  { icon: Stamp, title: 'Sellos a prueba de trampas', text: 'Solo tu personal registra sellos. Cada operación es única, trazable y auditada.' },
  { icon: Users, title: 'Roles y equipo', text: 'Administrador, gerente y empleado, cada uno con sus propias credenciales y permisos.' },
  { icon: BarChart3, title: 'Estadísticas reales', text: 'Clientes nuevos, visitas, horarios pico y clientes frecuentes, directo de tu base de datos.' },
  { icon: Store, title: 'Multiempresa', text: 'Cada cafetería con su marca, dominio, equipo y datos completamente aislados.' },
  { icon: ShieldCheck, title: 'Seguridad empresarial', text: 'Supabase Auth, Row Level Security y validación en servidor en cada operación.' },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <WebyaLogo />
        <Link href="/admin/login" className={buttonClasses('secondary', 'sm')}>Acceso para negocios</Link>
      </header>
      <main className="mx-auto max-w-6xl px-5">
        <section className="py-16 text-center sm:py-24 animate-rise">
          <p className="text-sm font-medium text-coffee-500">Fidelización para cafeterías y restaurantes</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">Clientes que vuelven, todos los días.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink-muted">Tarjeta de sellos digital, recompensas automáticas y un panel que tu equipo entiende desde el primer día.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/admin/login" className={buttonClasses('primary', 'lg')}>Entrar al panel</Link>
          </div>
        </section>
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <Icon className="size-5 text-coffee-600" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-ink-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-line py-8 text-center text-xs text-ink-muted">© {new Date().getFullYear()} WebYA · WebYA Loyalty System</footer>
    </div>
  );
}
