'use server';

import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIVE_BUSINESS_COOKIE, authorizeStaff, getStaffContext } from '@/lib/auth/staff';
import { friendlyError } from '@/lib/errors';
import { normalizePhone } from '@/lib/phone';
import {
  businessSettingsSchema,
  fieldErrors,
  programSchema,
  promotionSchema,
  purchaseSchema,
  rewardSchema,
  staffCustomerSchema,
  staffMemberSchema,
} from '@/lib/validation';
import type { ActionResult, CustomerOverview, StaffRole } from '@/lib/types';

const DENIED: ActionResult<never> = { ok: false, error: 'No tienes permiso para realizar esta acción.' };
const ALL: StaffRole[] = ['owner', 'manager', 'employee'];
const MANAGERS: StaffRole[] = ['owner', 'manager'];
const OWNER: StaffRole[] = ['owner'];

function refresh() {
  revalidatePath('/admin', 'layout');
}

// ---------------------------------------------------------------------
// Negocio activo (personal con varios negocios)
// ---------------------------------------------------------------------
export async function selectBusiness(formData: FormData) {
  const id = String(formData.get('businessId') ?? '');
  const ctx = await getStaffContext();
  if (!ctx?.memberships.some((m) => m.business.id === id)) return;
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 180 });
  refresh();
}

// ---------------------------------------------------------------------
// Búsqueda de clientes (teléfono, nombre o código QR)
// ---------------------------------------------------------------------
export async function searchCustomers(query: string): Promise<ActionResult<CustomerOverview[]>> {
  const ctx = await authorizeStaff(ALL);
  if (!ctx) return DENIED;
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return { ok: true, data: [] };
  const supabase = await createClient();
  let request = supabase.from('customer_overview').select('*').eq('business_id', ctx.business.id).limit(8);

  const qrMatch = q.match(/(?:webya:)?([a-f0-9]{24})$/i);
  const digits = q.replace(/\D/g, '');
  if (qrMatch) {
    request = request.eq('qr_token', qrMatch[1].toLowerCase());
  } else if (digits.length >= 4 && digits.length >= q.replace(/\s/g, '').length - 1) {
    request = request.ilike('phone', `%${digits.slice(-10)}%`);
  } else {
    const safe = q.replace(/[%_,()]/g, ' ').trim();
    const terms = safe.split(/\s+/).filter(Boolean);
    for (const term of terms) request = request.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data, error } = await request.order('last_visit_at', { ascending: false, nullsFirst: false });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: (data ?? []) as CustomerOverview[] };
}

export async function getCustomerForCounter(customerId: string) {
  const ctx = await authorizeStaff(ALL);
  if (!ctx) return null;
  const supabase = await createClient();
  const [{ data: customer }, { data: rewards }, { data: visits }] = await Promise.all([
    supabase.from('customer_overview').select('*').eq('id', customerId).eq('business_id', ctx.business.id).maybeSingle(),
    supabase
      .from('reward_redemptions')
      .select('id, code, stamps_cost, issued_at, expires_at, status, rewards(name, image_url)')
      .eq('customer_id', customerId)
      .eq('business_id', ctx.business.id)
      .eq('status', 'available')
      .order('stamps_cost'),
    supabase
      .from('visits')
      .select('id, created_at, stamps_awarded, amount')
      .eq('customer_id', customerId)
      .eq('business_id', ctx.business.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);
  if (!customer) return null;
  const rewardList = ((rewards ?? []) as unknown as {
    id: string; code: string; stamps_cost: number; expires_at: string | null;
    rewards: { name: string; image_url: string | null } | { name: string; image_url: string | null }[] | null;
  }[]).map((r) => {
    const rw = Array.isArray(r.rewards) ? r.rewards[0] : r.rewards;
    return { id: r.id, code: r.code, stamps_cost: r.stamps_cost, expires_at: r.expires_at, name: rw?.name ?? 'Recompensa' };
  });
  return {
    customer: customer as CustomerOverview,
    rewards: rewardList,
    visits: (visits ?? []) as { id: string; created_at: string; stamps_awarded: number; amount: number | null }[],
  };
}

// ---------------------------------------------------------------------
// Registrar compra / canjear
// ---------------------------------------------------------------------
export async function registerPurchase(input: {
  customerId: string;
  stamps: number;
  amount: string;
  idempotencyKey: string;
  note?: string;
  overrideCooldown?: boolean;
}): Promise<ActionResult<{ stamp_balance: number; new_rewards: number; duplicate: boolean }>> {
  const ctx = await authorizeStaff(ALL);
  if (!ctx) return DENIED;
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Revisa los datos de la compra.', fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('register_purchase', {
    p_business: ctx.business.id,
    p_customer: parsed.data.customerId,
    p_stamps: parsed.data.stamps,
    p_amount: parsed.data.amount,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_note: parsed.data.note,
    p_override_cooldown: parsed.data.overrideCooldown,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  const result = data as { stamp_balance: number; new_rewards: number; duplicate: boolean };
  return {
    ok: true,
    data: result,
    message: result.duplicate ? 'Esta compra ya estaba registrada; no se duplicaron sellos.' : 'Compra registrada.',
  };
}

export async function redeemReward(redemptionId: string): Promise<ActionResult<{ reward: string; stamp_balance: number }>> {
  const ctx = await authorizeStaff(ALL);
  if (!ctx) return DENIED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('redeem_reward', { p_business: ctx.business.id, p_redemption: redemptionId });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  const r = data as { reward: string; stamp_balance: number };
  return { ok: true, data: r, message: `Canje confirmado: ${r.reward}.` };
}

export async function adjustStamps(customerId: string, delta: number, note: string): Promise<ActionResult> {
  const ctx = await authorizeStaff(MANAGERS);
  if (!ctx) return DENIED;
  if (!Number.isInteger(delta) || delta === 0) return { ok: false, error: 'Indica una cantidad distinta de cero.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('adjust_stamps', {
    p_business: ctx.business.id,
    p_customer: customerId,
    p_delta: delta,
    p_note: note,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, message: 'Corrección registrada en el historial.' };
}

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------
export async function createCustomer(_: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await authorizeStaff(ALL);
  if (!ctx) return DENIED;
  const parsed = staffCustomerSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    email: formData.get('email') ?? undefined,
    marketingOptIn: formData.get('marketingOptIn') === 'on',
  });
  if (!parsed.success) return { ok: false, error: 'Revisa los campos.', fieldErrors: fieldErrors(parsed.error) };
  const phone = normalizePhone(parsed.data.phone, ctx.business.country_code);
  if (!phone) return { ok: false, error: 'El teléfono no es válido.', fieldErrors: { phone: 'Número no válido.' } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('staff_create_customer', {
    p_business: ctx.business.id,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: phone,
    p_email: parsed.data.email,
    p_marketing_opt_in: parsed.data.marketingOptIn,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, data: { id: data as string }, message: 'Cliente registrado.' };
}

export async function updateCustomer(customerId: string, _: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await authorizeStaff(MANAGERS);
  if (!ctx) return DENIED;
  const supabase = await createClient();
  const status = formData.get('status') === 'blocked' ? 'blocked' : 'active';
  const { error } = await supabase.rpc('update_customer', {
    p_business: ctx.business.id,
    p_customer: customerId,
    p_first_name: String(formData.get('firstName') ?? ''),
    p_last_name: String(formData.get('lastName') ?? ''),
    p_email: String(formData.get('email') ?? '') || null,
    p_notes: String(formData.get('notes') ?? '') || null,
    p_status: status,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, message: 'Cliente actualizado.' };
}

/** Restablece la contraseña de un cliente (atención en mostrador). */
export async function resetCustomerPassword(customerId: string): Promise<ActionResult<{ password: string }>> {
  const ctx = await authorizeStaff(MANAGERS);
  if (!ctx) return DENIED;
  const supabase = await createClient();
  // La RLS garantiza que el cliente pertenece al negocio del gerente.
  const { data: customer } = await supabase
    .from('customers')
    .select('id, user_id')
    .eq('id', customerId)
    .eq('business_id', ctx.business.id)
    .maybeSingle();
  if (!customer) return { ok: false, error: 'Cliente no encontrado.' };
  if (!customer.user_id) return { ok: false, error: 'Este cliente aún no tiene cuenta en línea.' };

  const temp = `Cafe${randomBytes(3).toString('hex')}${Math.floor(Math.random() * 90 + 10)}`;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(customer.user_id, { password: temp });
  if (error) return { ok: false, error: 'No pudimos restablecer la contraseña.' };
  await admin.from('audit_logs').insert({
    business_id: ctx.business.id,
    actor_id: ctx.userId,
    action: 'customer.password_reset',
    entity: 'customer',
    entity_id: customer.id,
    details: {},
  });
  return { ok: true, data: { password: temp }, message: 'Contraseña temporal generada.' };
}

// ---------------------------------------------------------------------
// Programa de sellos y recompensas (propietario)
// ---------------------------------------------------------------------
export async function updateProgram(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await authorizeStaff(OWNER);
  if (!ctx) return DENIED;
  const parsed = programSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'Revisa los campos.', fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_loyalty_program', {
    p_business: ctx.business.id,
    p_name: parsed.data.name,
    p_stamps_required: parsed.data.stampsRequired,
    p_reward_description: parsed.data.rewardDescription,
    p_max_stamps_per_visit: parsed.data.maxStampsPerVisit,
    p_cooldown_minutes: parsed.data.cooldownMinutes,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, message: 'Programa actualizado. Las tarjetas se recalcularon.' };
}

const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

async function uploadImage(businessId: string, file: File | null, folder: string): Promise<string | null | { error: string }> {
  if (!file || file.size === 0) return null;
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: 'Formato no permitido. Usa PNG, JPG o WEBP.' };
  if (file.size > 2 * 1024 * 1024) return { error: 'La imagen supera 2 MB.' };
  const admin = createAdminClient();
  const path = `${businessId}/${folder}/${randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('business-assets').upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: 'No pudimos subir la imagen.' };
  return admin.storage.from('business-assets').getPublicUrl(path).data.publicUrl;
}

export async function saveReward(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await authorizeStaff(OWNER);
  if (!ctx) return DENIED;
  const parsed = rewardSchema.safeParse({
    id: formData.get('id') ?? undefined,
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    stampsRequired: formData.get('stampsRequired'),
    isActive: formData.get('isActive') === 'on',
    validFrom: formData.get('validFrom') || undefined,
    validUntil: formData.get('validUntil') || undefined,
    maxPerCustomer: formData.get('maxPerCustomer') ?? undefined,
    maxTotal: formData.get('maxTotal') ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: 'Revisa los campos.', fieldErrors: fieldErrors(parsed.error) };

  const uploaded = await uploadImage(ctx.business.id, formData.get('image') as File | null, 'rewards');
  if (uploaded && typeof uploaded === 'object') return { ok: false, error: uploaded.error };
  const currentImage = String(formData.get('currentImage') ?? '') || null;
  const removeImage = formData.get('removeImage') === 'on';
  const imageUrl = (uploaded as string | null) ?? (removeImage ? null : currentImage);

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_reward', {
    p_business: ctx.business.id,
    p_id: parsed.data.id,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_image_url: imageUrl,
    p_stamps_required: parsed.data.stampsRequired,
    p_is_active: parsed.data.isActive,
    p_valid_from: parsed.data.validFrom,
    p_valid_until: parsed.data.validUntil,
    p_max_per_customer: parsed.data.maxPerCustomer,
    p_max_total: parsed.data.maxTotal,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, message: parsed.data.id ? 'Recompensa actualizada.' : 'Recompensa creada.' };
}

export async function deleteReward(rewardId: string): Promise<ActionResult> {
  const ctx = await authorizeStaff(OWNER);
  if (!ctx) return DENIED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('delete_reward', { p_business: ctx.business.id, p_id: rewardId });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return {
    ok: true,
    message: data === 'deactivated' ? 'La recompensa tiene canjes en el historial, así que se desactivó.' : 'Recompensa eliminada.',
  };
}

// ---------------------------------------------------------------------
// Configuración del negocio (propietario)
// ---------------------------------------------------------------------
export async function saveBusinessSettings(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await authorizeStaff(OWNER);
  if (!ctx) return DENIED;
  const parsed = businessSettingsSchema.safeParse({
    name: formData.get('name'),
    tagline: formData.get('tagline') ?? undefined,
    primaryColor: formData.get('primaryColor'),
    accentColor: formData.get('accentColor'),
    contactEmail: formData.get('contactEmail') ?? undefined,
    contactPhone: formData.get('contactPhone') ?? undefined,
    whatsapp: formData.get('whatsapp') ?? undefined,
    address: formData.get('address') ?? undefined,
    city: formData.get('city') ?? undefined,
    timezone: formData.get('timezone'),
    currency: formData.get('currency'),
    inactiveAfterDays: formData.get('inactiveAfterDays'),
  });
  if (!parsed.success) return { ok: false, error: 'Revisa los campos.', fieldErrors: fieldErrors(parsed.error) };

  const uploaded = await uploadImage(ctx.business.id, formData.get('logo') as File | null, 'logo');
  if (uploaded && typeof uploaded === 'object') return { ok: false, error: uploaded.error };
  const removeLogo = formData.get('removeLogo') === 'on';
  const logoUrl = (uploaded as string | null) ?? (removeLogo ? null : ctx.business.logo_url);

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_business_settings', {
    p_business: ctx.business.id,
    p_name: d.name,
    p_tagline: d.tagline,
    p_logo_url: logoUrl,
    p_primary_color: d.primaryColor,
    p_accent_color: d.accentColor,
    p_contact_email: d.contactEmail,
    p_contact_phone: d.contactPhone,
    p_whatsapp: d.whatsapp,
    p_address: d.address,
    p_city: d.city,
    p_timezone: d.timezone,
    p_currency: d.currency,
    p_inactive_after_days: d.inactiveAfterDays,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, message: 'Configuración guardada.' };
}

// ---------------------------------------------------------------------
// Equipo (propietario)
// ---------------------------------------------------------------------
export async function createStaffMember(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await authorizeStaff(OWNER);
  if (!ctx) return DENIED;
  const parsed = staffMemberSchema.safeParse({
    email: formData.get('email'),
    displayName: formData.get('displayName'),
    role: formData.get('role'),
    position: formData.get('position') ?? undefined,
    phone: formData.get('phone') ?? undefined,
    password: formData.get('password'),
  });
  if (!parsed.success) return { ok: false, error: 'Revisa los campos.', fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const admin = createAdminClient();

  let userId: string | null = null;
  let existed = false;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    app_metadata: { kind: 'staff', full_name: d.displayName },
  });
  if (created?.user) {
    userId = created.user.id;
  } else if (createError && /already|exists|registered/i.test(createError.message)) {
    const { data: existing } = await admin.from('profiles').select('id, kind').eq('email', d.email).maybeSingle();
    if (!existing) return { ok: false, error: 'Ese correo ya existe pero no pudimos vincularlo.' };
    if (existing.kind !== 'staff') return { ok: false, error: 'Ese correo pertenece a una cuenta de cliente.' };
    userId = existing.id;
    existed = true;
  } else {
    console.error('[create-staff]', createError?.message);
    return { ok: false, error: 'No pudimos crear la cuenta.' };
  }

  // La autorización final (rol de propietario) la valida la base de datos.
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_staff_member', {
    p_business: ctx.business.id,
    p_user_id: userId,
    p_role: d.role,
    p_display_name: d.displayName,
    p_position: d.position,
    p_phone: d.phone,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return {
    ok: true,
    message: existed
      ? 'La persona ya tenía cuenta en WebYA: se le dio acceso y usará su contraseña actual.'
      : 'Cuenta creada. Comparte la contraseña inicial de forma privada; podrá cambiarla en «Mi cuenta».',
  };
}

export async function updateStaffMember(membershipId: string, _: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await authorizeStaff(OWNER);
  if (!ctx) return DENIED;
  const role = formData.get('role') === 'manager' ? 'manager' : 'employee';
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_staff_member', {
    p_business: ctx.business.id,
    p_membership: membershipId,
    p_role: role,
    p_is_active: formData.get('isActive') === 'on',
    p_display_name: String(formData.get('displayName') ?? ''),
    p_position: String(formData.get('position') ?? '') || null,
    p_phone: String(formData.get('phone') ?? '') || null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, message: 'Cambios guardados.' };
}

// ---------------------------------------------------------------------
// Promociones (propietario / gerente)
// ---------------------------------------------------------------------
export async function savePromotion(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await authorizeStaff(MANAGERS);
  if (!ctx) return DENIED;
  const parsed = promotionSchema.safeParse({
    id: formData.get('id') ?? undefined,
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    kind: formData.get('kind'),
    segment: formData.get('segment'),
    discountPercent: formData.get('discountPercent') ?? undefined,
    bonusStamps: formData.get('bonusStamps') ?? undefined,
    startsAt: formData.get('startsAt') || undefined,
    endsAt: formData.get('endsAt') || undefined,
    isActive: formData.get('isActive') === 'on',
  });
  if (!parsed.success) return { ok: false, error: 'Revisa los campos.', fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_promotion', {
    p_business: ctx.business.id,
    p_id: d.id,
    p_title: d.title,
    p_description: d.description,
    p_kind: d.kind,
    p_segment: d.segment,
    p_discount_percent: d.discountPercent,
    p_bonus_stamps: d.bonusStamps,
    p_starts_at: d.startsAt,
    p_ends_at: d.endsAt,
    p_is_active: d.isActive,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, message: d.id ? 'Promoción actualizada.' : 'Promoción creada.' };
}

export async function sendPromotion(promotionId: string): Promise<ActionResult> {
  const ctx = await authorizeStaff(MANAGERS);
  if (!ctx) return DENIED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('send_promotion', { p_business: ctx.business.id, p_promotion: promotionId });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  const r = data as { notified: number; email_queued: number; bonus_customers: number };
  const parts = [`${r.notified} clientes notificados en su tarjeta`];
  if (r.bonus_customers) parts.push(`${r.bonus_customers} recibieron sellos de regalo`);
  if (r.email_queued) parts.push(`${r.email_queued} correos en cola (pendiente de integración)`);
  return { ok: true, message: parts.join(' · ') + '.' };
}

// ---------------------------------------------------------------------
// QR de sello de un solo uso (el cliente lo escanea con su teléfono)
// ---------------------------------------------------------------------
export async function createStampClaim(stamps: number, amount: string): Promise<ActionResult<{ id: string; token: string; expires_at: string; stamps: number }>> {
  const ctx = await authorizeStaff(ALL);
  if (!ctx) return DENIED;
  const n = Number(stamps);
  const amt = amount.trim() === '' ? null : Number(amount);
  if (!Number.isInteger(n) || n < 1 || n > 20) return { ok: false, error: 'Cantidad de sellos no válida.' };
  if (amt !== null && (!Number.isFinite(amt) || amt < 0)) return { ok: false, error: 'Importe no válido.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_stamp_claim', { p_business: ctx.business.id, p_stamps: n, p_amount: amt, p_ttl_seconds: 120 });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: data as { id: string; token: string; expires_at: string; stamps: number } };
}

export async function getStampClaimStatus(claimId: string): Promise<ActionResult<{ status: string; customer_name: string | null }>> {
  const ctx = await authorizeStaff(ALL);
  if (!ctx) return DENIED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_stamp_claim_status', { p_business: ctx.business.id, p_claim: claimId });
  if (error) return { ok: false, error: friendlyError(error) };
  const d = data as { status: string; customer_name: string | null };
  if (d.status === 'claimed') refresh();
  return { ok: true, data: d };
}

export async function cancelStampClaim(claimId: string): Promise<void> {
  const ctx = await authorizeStaff(ALL);
  if (!ctx) return;
  const supabase = await createClient();
  await supabase.rpc('cancel_stamp_claim', { p_business: ctx.business.id, p_claim: claimId });
}
