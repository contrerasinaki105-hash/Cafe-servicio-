import 'server-only';

/**
 * Los clientes inician sesión con teléfono + contraseña. Supabase Auth
 * requiere un identificador; usamos un correo interno derivado del
 * teléfono (no se envía correo a esa dirección). El teléfono real queda
 * en app_metadata, que solo el servidor puede escribir.
 */
export function customerAuthEmail(e164: string): string {
  const domain = process.env.CUSTOMER_AUTH_EMAIL_DOMAIN || 'clientes.webya.app';
  return `tel-${e164.replace(/\D/g, '')}@${domain}`;
}
