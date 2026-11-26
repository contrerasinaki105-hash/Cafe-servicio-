import 'server-only';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim();
}

/**
 * Límite de intentos en base de datos (compartido entre instancias).
 * Devuelve true si la operación está permitida.
 */
export async function rateLimit(scope: string, max: number, windowSeconds: number): Promise<boolean> {
  const ip = await clientIp();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: `${scope}:${ip}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return Boolean(data);
  } catch (e) {
    // Si el limitador falla no bloqueamos el acceso, pero queda registrado.
    console.error('[rate-limit]', e);
    return true;
  }
}
