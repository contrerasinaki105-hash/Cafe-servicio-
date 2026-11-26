import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres.')
  .max(72, 'Máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'Incluye al menos una letra.')
  .regex(/\d/, 'Incluye al menos un número.');

export const emailSchema = z.string().trim().toLowerCase().email('Correo electrónico no válido.').max(160);
export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, 'Correo electrónico no válido.');

export const nameSchema = trimmed(60).min(1, 'Obligatorio.');

export const customerRegisterSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    phone: z.string().trim().min(7, 'Teléfono no válido.').max(20),
    email: optionalEmail,
    password: passwordSchema,
    confirmPassword: z.string(),
    marketingOptIn: z.boolean(),
    acceptTerms: z.literal(true, { error: 'Debes aceptar el aviso de privacidad.' }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' });

export const customerLoginSchema = z.object({
  phone: z.string().trim().min(7, 'Teléfono no válido.').max(20),
  password: z.string().min(1, 'Escribe tu contraseña.').max(72),
});

export const staffLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Escribe tu contraseña.').max(72),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual.'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ['newPassword'], message: 'Usa una contraseña diferente a la actual.' });

export const resetPasswordSchema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' });

export const staffMemberSchema = z.object({
  email: emailSchema,
  displayName: trimmed(120).min(2, 'Obligatorio.'),
  role: z.enum(['manager', 'employee']),
  position: optionalText(80),
  phone: optionalText(20),
  password: passwordSchema,
});

export const staffCustomerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: z.string().trim().min(7, 'Teléfono no válido.').max(20),
  email: optionalEmail,
  marketingOptIn: z.boolean(),
});

export const purchaseSchema = z.object({
  customerId: z.string().uuid(),
  stamps: z.coerce.number().int().min(1).max(20),
  amount: z
    .union([z.literal(''), z.coerce.number().min(0, 'Importe no válido.').max(1_000_000)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  idempotencyKey: z.string().uuid(),
  note: optionalText(280),
  overrideCooldown: z.boolean().default(false),
});

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color no válido.');

export const businessSettingsSchema = z.object({
  name: trimmed(120).min(2, 'Obligatorio.'),
  tagline: optionalText(160),
  primaryColor: hex,
  accentColor: hex,
  contactEmail: optionalEmail,
  contactPhone: optionalText(30),
  whatsapp: optionalText(30),
  address: optionalText(200),
  city: optionalText(80),
  timezone: z.string().min(2).max(64),
  currency: z.string().regex(/^[A-Za-z]{3}$/, 'Usa un código de 3 letras (MXN, USD, EUR).'),
  inactiveAfterDays: z.coerce.number().int().min(7).max(365),
});

export const programSchema = z.object({
  name: trimmed(80).min(2, 'Obligatorio.'),
  stampsRequired: z.coerce.number().int().min(3, 'Mínimo 3.').max(50, 'Máximo 50.'),
  rewardDescription: trimmed(80).min(2, 'Obligatorio.'),
  maxStampsPerVisit: z.coerce.number().int().min(1).max(20),
  cooldownMinutes: z.coerce.number().int().min(0).max(1440),
});

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v).toISOString() : null));
const optionalPositiveInt = z
  .union([z.literal(''), z.coerce.number().int().min(1)])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

export const rewardSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  name: trimmed(80).min(2, 'Obligatorio.'),
  description: optionalText(280),
  stampsRequired: z.coerce.number().int().min(1).max(500),
  isActive: z.boolean(),
  validFrom: optionalDate,
  validUntil: optionalDate,
  maxPerCustomer: optionalPositiveInt,
  maxTotal: optionalPositiveInt,
});

export const promotionSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  title: trimmed(100).min(3, 'Mínimo 3 caracteres.'),
  description: optionalText(500),
  kind: z.enum(['discount', 'special_reward', 'temporary', 'frequent', 'winback']),
  segment: z.enum(['all', 'frequent', 'inactive', 'new', 'near_reward', 'pending_reward']),
  discountPercent: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(100)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  bonusStamps: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(20)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  startsAt: optionalDate,
  endsAt: optionalDate,
  isActive: z.boolean(),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
