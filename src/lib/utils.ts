import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(value: string | Date | null | undefined, tz?: string, withTime = false) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: tz,
  }).format(d);
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return 'Nunca';
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Justo ahora';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `Hace ${d} ${d === 1 ? 'día' : 'días'}`;
  const m = Math.round(d / 30);
  if (m < 12) return `Hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
  const y = Math.round(m / 12);
  return `Hace ${y} ${y === 1 ? 'año' : 'años'}`;
}

export function formatMoney(value: number | string | null | undefined, currency = 'MXN') {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
}

export function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat('es-MX').format(Number(value ?? 0));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/** Color de texto legible (blanco/oscuro) sobre un color de fondo hex. */
export function readableOn(hex: string) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#2B1D14' : '#FFFFFF';
}
