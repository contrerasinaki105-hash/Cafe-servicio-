export const PHONE_COUNTRIES = [
  ['GT', '+502', 'Guatemala'], ['MX', '+52', 'México'], ['SV', '+503', 'El Salvador'], ['HN', '+504', 'Honduras'],
  ['NI', '+505', 'Nicaragua'], ['CR', '+506', 'Costa Rica'], ['PA', '+507', 'Panamá'], ['CO', '+57', 'Colombia'],
  ['EC', '+593', 'Ecuador'], ['PE', '+51', 'Perú'], ['CL', '+56', 'Chile'], ['AR', '+54', 'Argentina'],
  ['DO', '+1', 'Rep. Dominicana'], ['US', '+1', 'Estados Unidos'], ['ES', '+34', 'España'],
] as const;

export function pickCountry(value: FormDataEntryValue | null, fallback: string) {
  const v = String(value ?? '').toUpperCase();
  return PHONE_COUNTRIES.some(([c]) => c === v) ? v : fallback;
}
