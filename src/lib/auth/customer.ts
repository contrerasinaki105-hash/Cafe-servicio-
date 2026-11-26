import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { PublicBusiness } from '@/lib/types';

export const getPublicBusiness = cache(async (slug: string): Promise<PublicBusiness | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_business', { p_slug: slug });
  if (error) throw error;
  return (data as PublicBusiness | null) ?? null;
});

export interface CustomerSession {
  userId: string;
  isCustomerAccount: boolean;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    qr_token: string;
    marketing_opt_in: boolean;
    status: 'active' | 'blocked';
    created_at: string;
  } | null;
}

/** Sesión del cliente dentro de un negocio concreto. */
export const getCustomerSession = cache(async (businessId: string): Promise<CustomerSession | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: customer }] = await Promise.all([
    supabase.from('profiles').select('kind').eq('id', user.id).maybeSingle(),
    supabase
      .from('customers')
      .select('id, first_name, last_name, phone, email, qr_token, marketing_opt_in, status, created_at')
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  return { userId: user.id, isCustomerAccount: profile?.kind === 'customer', customer: customer ?? null };
});
