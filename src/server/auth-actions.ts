'use server';

import { redirect } from 'next/navigation';
import { createClient as createSupabaseJs } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';
import { customerAuthEmail } from '@/lib/customer-identity';
import { normalizePhone } from '@/lib/phone';
import { pickCountry } from '@/lib/countries';
import { friendlyError } from '@/lib/errors';
import { getPublicBusiness } from '@/lib/auth/customer';
import {
  changePasswordSchema,
  customerLoginSchema,
  customerRegisterSchema,
  emailSchema,
  fieldErrors,
  nameSchema,
  optionalEmail,
  resetPasswordSchema,
  staffLoginSchema,
} from '@/lib/validation';
import type { ActionResult } from '@/lib/types';
import { rateLimit } from './rate-limit';

const TOO_MANY: ActionResult = { ok: false, error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' };

/** Valores no sensibles para volver a rellenar el formulario tras un error. */
function keep(formData: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((f) => [f, String(formData.get(f) ?? '')]));
}
const REGISTER_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'country'];

/** Destino tras el login del cliente: solo se permite volver a un QR de sello. */
function claimNext(formData: FormData) {
  const v = String(formData.get('next') ?? '');
  return /^\/s\/[a-f0-9]{36}$/.test(v) ? v : null;
}

function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const v = typeof next === 'string' ? next : '';
  return v.startsWith('/') && !v.startsWith('//') ? v : fallback;
}

// =====================================================================
// Personal (panel /admin)
// =====================================================================

export async function staffLogin(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = staffLoginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { ok: false, error: 'Revisa los datos.', fieldErrors: fieldErrors(parsed.error), values: keep(formData, ['email']) };
  if (!(await rateLimit('staff-login', 10, 600))) return { ...TOO_MANY, values: keep(formData, ['email']) } as ActionResult;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, error: 'Correo o contraseña incorrectos.', values: keep(formData, ['email']) };

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from('profiles').select('kind, is_platform_admin').eq('id', data.user.id).maybeSingle(),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('user_id', data.user.id).eq('is_active', true),
  ]);

  if (profile?.kind !== 'staff' || (!count && !profile?.is_platform_admin)) {
    await supabase.auth.signOut();
    return { ok: false, error: 'Esta cuenta no tiene acceso al panel administrativo.', values: keep(formData, ['email']) };
  }

  const fallback = !count && profile?.is_platform_admin ? '/platform' : '/admin';
  redirect(safeNext(formData.get('next'), fallback));
}

export async function signOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeNext(formData.get('next'), '/admin/login'));
}

export async function requestPasswordReset(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return { ok: false, error: 'Correo electrónico no válido.' };
  if (!(await rateLimit('password-reset', 5, 900))) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/admin/restablecer`,
  });
  if (error) console.error('[password-reset]', error.message);
  // Respuesta idéntica exista o no la cuenta (evita enumeración de usuarios).
  return { ok: true, message: 'Si el correo pertenece a una cuenta, recibirás un enlace para restablecer tu contraseña.' };
}

export async function completePasswordReset(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return { ok: false, error: 'Revisa la contraseña.', fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'El enlace expiró. Solicita uno nuevo.' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { ok: false, error: 'No pudimos actualizar la contraseña. Solicita un nuevo enlace.' };
  redirect('/admin?password=actualizada');
}

/** Cambio de contraseña con verificación de la contraseña actual. */
export async function changePassword(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return { ok: false, error: 'Revisa los campos.', fieldErrors: fieldErrors(parsed.error) };
  if (!(await rateLimit('change-password', 8, 600))) return TOO_MANY;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' };

  // Verificación con un cliente aislado (no toca las cookies de la sesión).
  const verifier = createSupabaseJs(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) return { ok: false, error: 'La contraseña actual no es correcta.', fieldErrors: { currentPassword: 'Incorrecta.' } };
  await verifier.auth.signOut();

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { ok: false, error: 'No pudimos actualizar la contraseña.' };
  return { ok: true, message: 'Contraseña actualizada correctamente.' };
}

// =====================================================================
// Clientes (portal /c/[slug])
// =====================================================================

export async function customerRegister(slug: string, _: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const business = await getPublicBusiness(slug);
  if (!business) return { ok: false, error: 'Este negocio no existe o no está activo.', values: keep(formData, REGISTER_FIELDS) };

  const parsed = customerRegisterSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    email: formData.get('email') ?? undefined,
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    marketingOptIn: formData.get('marketingOptIn') === 'on',
    acceptTerms: formData.get('acceptTerms') === 'on',
  });
  if (!parsed.success) return { ok: false, error: 'Revisa los campos marcados.', fieldErrors: fieldErrors(parsed.error), values: keep(formData, REGISTER_FIELDS) };
  const phone = normalizePhone(parsed.data.phone, pickCountry(formData.get('country'), business.country_code));
  if (!phone) return { ok: false, error: 'El teléfono no es válido.', fieldErrors: { phone: 'Revisa el número (10 dígitos).' }, values: keep(formData, REGISTER_FIELDS) };
  if (!(await rateLimit('customer-register', 10, 3600))) return { ...TOO_MANY, values: keep(formData, REGISTER_FIELDS) } as ActionResult;

  const authEmail = customerAuthEmail(phone);
  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { kind: 'customer', phone, full_name: `${parsed.data.firstName} ${parsed.data.lastName}` },
  });
  const alreadyExists = createError && /already|exists|registered/i.test(createError.message);
  if (createError && !alreadyExists) {
    console.error('[customer-register]', createError.message);
    const config = /invalid api key|jwt|unauthorized|forbidden/i.test(createError.message);
    return {
      ok: false,
      error: config
        ? 'El servicio de registro no está disponible por un problema de configuración. Avisa al personal del negocio.'
        : 'No pudimos crear tu cuenta. Inténtalo de nuevo.',
      values: keep(formData, REGISTER_FIELDS),
    };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: authEmail, password: parsed.data.password });
  if (signInError) {
    return alreadyExists
      ? { ok: false, error: 'Ese teléfono ya tiene una cuenta. Inicia sesión con tu contraseña.', fieldErrors: { phone: 'Ya registrado.' }, values: keep(formData, REGISTER_FIELDS) }
      : { ok: false, error: 'Cuenta creada, pero no pudimos iniciar sesión. Intenta entrar.', values: keep(formData, REGISTER_FIELDS) };
  }

  const { error } = await supabase.rpc('join_business', {
    p_slug: slug,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_email: parsed.data.email,
    p_marketing_opt_in: parsed.data.marketingOptIn,
  });
  if (error) return { ok: false, error: friendlyError(error), values: keep(formData, REGISTER_FIELDS) };
  redirect(claimNext(formData) ?? `/c/${slug}/tarjeta?bienvenida=1`);
}

export async function customerLogin(slug: string, _: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const business = await getPublicBusiness(slug);
  if (!business) return { ok: false, error: 'Este negocio no existe o no está activo.', values: keep(formData, ['phone', 'country']) };
  const parsed = customerLoginSchema.safeParse({ phone: formData.get('phone'), password: formData.get('password') });
  if (!parsed.success) return { ok: false, error: 'Revisa los datos.', fieldErrors: fieldErrors(parsed.error), values: keep(formData, ['phone', 'country']) };
  const phone = normalizePhone(parsed.data.phone, pickCountry(formData.get('country'), business.country_code));
  if (!phone) return { ok: false, error: 'El teléfono no es válido.', fieldErrors: { phone: 'Revisa el número.' }, values: keep(formData, ['phone', 'country']) };
  if (!(await rateLimit('customer-login', 15, 600))) return { ...TOO_MANY, values: keep(formData, ['phone', 'country']) } as ActionResult;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: customerAuthEmail(phone), password: parsed.data.password });
  if (error || !data.user) return { ok: false, error: 'Teléfono o contraseña incorrectos.', values: keep(formData, ['phone', 'country']) };

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', business.id)
    .eq('user_id', data.user.id)
    .maybeSingle();
  const next = claimNext(formData);
  if (customer) redirect(next ?? `/c/${slug}/tarjeta`);
  redirect(`/c/${slug}/unirse${next ? `?next=${encodeURIComponent(next)}` : ''}`);
}

/** Cliente con cuenta existente que se une a otro negocio. */
export async function customerJoin(slug: string, _: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const first = nameSchema.safeParse(formData.get('firstName'));
  const last = nameSchema.safeParse(formData.get('lastName'));
  const email = optionalEmail.safeParse(formData.get('email') ?? undefined);
  if (!first.success || !last.success || !email.success) return { ok: false, error: 'Revisa los campos.' };
  if (formData.get('acceptTerms') !== 'on') return { ok: false, error: 'Debes aceptar el aviso de privacidad.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('join_business', {
    p_slug: slug,
    p_first_name: first.data,
    p_last_name: last.data,
    p_email: email.data,
    p_marketing_opt_in: formData.get('marketingOptIn') === 'on',
  });
  if (error) return { ok: false, error: friendlyError(error) };
  redirect(claimNext(formData) ?? `/c/${slug}/tarjeta?bienvenida=1`);
}
