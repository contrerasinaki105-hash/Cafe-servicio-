import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** Normaliza un teléfono a formato E.164 (+5215512345678). */
export function normalizePhone(input: string, country: string = 'MX'): string | null {
  const cleaned = (input ?? '').replace(/[^\d+]/g, '');
  if (cleaned.length < 7) return null;
  const parsed = parsePhoneNumberFromString(cleaned, country.toUpperCase() as CountryCode);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
