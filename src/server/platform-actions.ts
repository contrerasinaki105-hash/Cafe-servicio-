'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffContext } from '@/lib/auth/staff';
import { friendlyError } from '@/lib/errors';
import { emailSchema, fieldErrors, passwordSchema } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/, 'Solo minúsculas, números y guiones (3-48).'),
  customDomain: z.string().trim().toLowerCase().max(120).optional().transform((v) => v || null),
  countryCode: z.string().length(2),
  timezone: z.string().min(2),
  currency: z.string().length(3),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: emailSchema,
  ownerPassword: passwordSchema,
});

/** Alta de un nuevo negocio cliente de WebYA (solo administradores de plataforma). */
export async function createBusiness(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getStaffContext();
  if (!ctx?.isPlatformAdmin) return { ok: false, error: 'No tienes permiso para realizar esta acción.' };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'Revisa los campos.', fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const admin = createAdminClient();
  let ownerId: string;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: d.ownerEmail,
    password: d.ownerPassword,
    email_confirm: true,
    app_metadata: { kind: 'staff', full_name: d.ownerName },
  });
  if (created?.user) ownerId = created.user.id;
  else {
    const { data: existing } = await admin.from('profiles').select('id, kind').eq('email', d.ownerEmail).maybeSingle();
    if (!existing || existing.kind !== 'staff') {
      return { ok: false, error: createError?.message ? 'No pudimos crear la cuenta del propietario.' : 'Error desconocido.' };
    }
    ownerId = existing.id;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_business', {
    p_slug: d.slug,
    p_name: d.name,
    p_owner_user_id: ownerId,
    p_owner_name: d.ownerName,
    p_country_code: d.countryCode,
    p_timezone: d.timezone,
    p_currency: d.currency,
    p_custom_domain: d.customDomain,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/platform');
  return { ok: true, message: `Negocio «${d.name}» creado. El propietario ya puede entrar en /admin.` };
}
