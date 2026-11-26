import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertSupabaseConfigured, publicEnv } from '@/lib/env';

/**
 * Cliente de Supabase con la sesión del usuario (cookies httpOnly).
 * Todas las consultas pasan por RLS con la identidad del usuario.
 */
export async function createClient() {
  assertSupabaseConfigured();
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el proxy refresca la sesión.
        }
      },
    },
  });
}
