import { describe, expect, it } from 'vitest';
import { normalizePhone } from '@/lib/phone';
import { friendlyError } from '@/lib/errors';
import { readableOn } from '@/lib/utils';
import { customerAuthEmail } from '@/lib/customer-identity';

describe('teléfonos', () => {
  it('normaliza números de México a E.164', () => {
    expect(normalizePhone('55 1234 5678', 'MX')).toBe('+525512345678');
    expect(normalizePhone('+52 55-1234-5678', 'MX')).toBe('+525512345678');
  });
  it('respeta el país del negocio', () => {
    expect(normalizePhone('300 123 4567', 'CO')).toBe('+573001234567');
  });
  it('rechaza números inválidos', () => {
    expect(normalizePhone('123', 'MX')).toBeNull();
    expect(normalizePhone('abc', 'MX')).toBeNull();
  });
});

describe('mensajes de error', () => {
  it('traduce códigos del servidor', () => {
    expect(friendlyError({ message: 'ALREADY_REDEEMED' })).toMatch(/ya fue canjeada/);
    expect(friendlyError({ message: 'permission denied for table stamps' })).toMatch(/permiso/);
  });
  it('no filtra detalles internos', () => {
    expect(friendlyError({ message: 'relation "x" does not exist' })).toMatch(/inesperado/);
  });
});

describe('identidad de clientes', () => {
  it('deriva un identificador interno estable del teléfono', () => {
    expect(customerAuthEmail('+525512345678')).toBe('tel-525512345678@clientes.webya.app');
  });
});

describe('contraste de marca', () => {
  it('elige texto legible sobre el color del negocio', () => {
    expect(readableOn('#6F4E37')).toBe('#FFFFFF');
    expect(readableOn('#F5EFE6')).toBe('#2B1D14');
  });
});
