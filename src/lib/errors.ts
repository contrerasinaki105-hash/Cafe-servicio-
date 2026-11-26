/** Traduce los códigos de error del servidor a mensajes claros. */
const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  NOT_FOUND: 'No encontramos el registro solicitado.',
  NO_ACTIVE_PROGRAM: 'El negocio no tiene un programa de fidelización activo.',
  INVALID_NAME: 'Revisa el nombre: es obligatorio.',
  INVALID_PHONE: 'El número de teléfono no es válido.',
  INVALID_EMAIL: 'El correo electrónico no es válido.',
  INVALID_STAMP_COUNT: 'La cantidad de sellos no está permitida.',
  INVALID_AMOUNT: 'El importe no es válido.',
  INVALID_DATES: 'La fecha de fin debe ser posterior a la de inicio.',
  INVALID_DISCOUNT: 'El descuento debe estar entre 1% y 100%.',
  INVALID_SETTINGS: 'Revisa los valores de configuración.',
  INVALID_TIMEZONE: 'Zona horaria no válida.',
  INVALID_IMAGE_URL: 'La imagen debe ser una URL segura (https).',
  INVALID_REWARD: 'Describe la recompensa.',
  IDEMPOTENCY_KEY_REQUIRED: 'Operación inválida. Recarga la página.',
  PHONE_ALREADY_REGISTERED: 'Ese teléfono ya está registrado en este negocio.',
  NOT_A_CUSTOMER_ACCOUNT: 'Esta cuenta no es una cuenta de cliente.',
  NOT_A_STAFF_ACCOUNT: 'Ese correo pertenece a una cuenta de cliente; usa otro correo para el personal.',
  BUSINESS_NOT_FOUND: 'Este negocio no existe o no está activo.',
  CUSTOMER_BLOCKED: 'Este cliente está bloqueado. Consulta con un gerente.',
  COOLDOWN_ACTIVE: 'Este cliente ya registró una compra hace unos minutos. Un gerente puede autorizar otra.',
  INSUFFICIENT_BALANCE: 'El cliente no tiene sellos suficientes.',
  REASON_REQUIRED: 'Indica el motivo de la corrección.',
  ALREADY_REDEEMED: 'Esta recompensa ya fue canjeada.',
  REWARD_NOT_AVAILABLE: 'Esta recompensa ya no está disponible.',
  REWARD_EXPIRED: 'Esta recompensa caducó.',
  BASE_REWARD_CANNOT_BE_DELETED: 'La recompensa principal del programa no se puede eliminar; edítala en Sellos.',
  ROLE_NOT_ALLOWED: 'No puedes asignar ese rol.',
  CANNOT_MODIFY_SELF: 'No puedes modificar tu propio acceso.',
  CANNOT_MODIFY_OWNER: 'No se puede modificar al propietario.',
  SLUG_TAKEN: 'Ese identificador ya está en uso.',
  PROMOTION_INACTIVE: 'La promoción no está activa o ya terminó.',
  ALREADY_SENT: 'Esta campaña ya fue enviada.',
};

export function friendlyError(error: unknown, fallback = 'Ocurrió un error inesperado. Inténtalo de nuevo.'): string {
  const raw =
    typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const code = raw.match(/[A-Z][A-Z_]{3,}/)?.[0];
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (/permission denied/i.test(raw)) return MESSAGES.FORBIDDEN;
  return fallback;
}

export function errorCode(error: unknown): string | null {
  const raw = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error ?? '');
  return raw.match(/[A-Z][A-Z_]{3,}/)?.[0] ?? null;
}
