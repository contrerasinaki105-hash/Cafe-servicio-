import 'server-only';
import { headers } from 'next/headers';
import { getPublicBusiness } from '@/lib/auth/customer';
import { isSupabaseConfigured } from '@/lib/env';

/** Marca del negocio cuando se accede desde su dominio o subdominio. */
export async function getHostBrand() {
  if (!isSupabaseConfigured()) return null;
  const slug = (await headers()).get('x-webya-tenant');
  if (!slug) return null;
  try {
    return await getPublicBusiness(slug);
  } catch {
    return null;
  }
}
