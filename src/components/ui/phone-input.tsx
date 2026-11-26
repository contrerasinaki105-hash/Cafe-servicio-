import { PHONE_COUNTRIES } from '@/lib/countries';
import { Input } from './field';

/** Teléfono con selector de país (por defecto, el del negocio). */
export function PhoneInput({ id, defaultCountry, defaultValue, invalid, autoFocus }: { id: string; defaultCountry: string; defaultValue?: string; invalid?: boolean; autoFocus?: boolean }) {
  const known = PHONE_COUNTRIES.some(([c]) => c === defaultCountry) ? defaultCountry : 'GT';
  return (
    <div className="flex gap-2">
      <select name="country" defaultValue={known} aria-label="País del teléfono"
        className="h-11 w-[104px] shrink-0 rounded-xl border border-line-strong bg-surface px-2 text-[15px] sm:h-10 sm:text-sm">
        {PHONE_COUNTRIES.map(([c, code, name]) => <option key={c} value={c}>{code} {name}</option>)}
      </select>
      <Input id={id} name="phone" type="tel" inputMode="tel" autoComplete="tel-national" required autoFocus={autoFocus}
        defaultValue={defaultValue} aria-invalid={invalid} className="flex-1" />
    </div>
  );
}
