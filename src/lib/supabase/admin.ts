import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';

/**
 * Cliente con service_role. SOLO servidor. Omite la RLS, por lo que cada
 * uso debe ir precedido de una verificación explícita de permisos.
 * Se usa únicamente para: crear cuentas de Auth, restablecer contraseñas
 * de clientes, subir imágenes y límites de intentos.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor (ver .env.example).');
  }
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
