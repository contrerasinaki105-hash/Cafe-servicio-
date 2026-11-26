'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';
import type { ActionResult } from '@/lib/types';

export async function setMarketingConsent(slug: string, businessId: string, optIn: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_marketing_consent', { p_business: businessId, p_opt_in: optIn });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: optIn ? 'Recibirás promociones de este negocio.' : 'Ya no recibirás promociones.' };
}

export async function markNotificationsRead(slug: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('mark_notifications_read', { p_ids: null });
  revalidatePath(`/c/${slug}`, 'layout');
}

export async function customerSignOut(slug: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/c/${slug}`);
}

export async function claimStamps(token: string): Promise<ActionResult<{ slug: string; stamps: number; stamp_balance: number; new_rewards: number; duplicate: boolean }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('claim_stamps', { p_token: token });
  if (error) return { ok: false, error: friendlyError(error) };
  const r = data as { slug: string; stamps: number; stamp_balance: number; new_rewards: number; duplicate: boolean };
  revalidatePath(`/c/${r.slug}`, 'layout');
  return { ok: true, data: r };
}
