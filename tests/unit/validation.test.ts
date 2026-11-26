import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  changePasswordSchema,
  customerRegisterSchema,
  passwordSchema,
  purchaseSchema,
  rewardSchema,
  staffMemberSchema,
} from '@/lib/validation';

describe('política de contraseñas', () => {
  it.each(['corta1', 'sololetras', '12345678', ''])('rechaza «%s»', (p) => {
    expect(passwordSchema.safeParse(p).success).toBe(false);
  });
  it('acepta contraseñas con letras y números de 8+ caracteres', () => {
    expect(passwordSchema.safeParse('Cafe2026').success).toBe(true);
  });
  it('el cambio exige confirmar y que sea distinta a la actual', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'Cafe2026', newPassword: 'Cafe2026', confirmPassword: 'Cafe2026' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: 'Cafe2026', newPassword: 'Latte2027', confirmPassword: 'Latte2028' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: 'Cafe2026', newPassword: 'Latte2027', confirmPassword: 'Latte2027' }).success).toBe(true);
  });
});

describe('registro de clientes', () => {
  const base = {
    firstName: 'Ana', lastName: 'López', phone: '55 1234 5678', email: '', password: 'Cafe2026',
    confirmPassword: 'Cafe2026', marketingOptIn: false, acceptTerms: true,
  };
  it('el correo es opcional', () => {
    const r = customerRegisterSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBeNull();
  });
  it('exige aceptar el aviso de privacidad', () => {
    expect(customerRegisterSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });
  it('rechaza correos inválidos y contraseñas que no coinciden', () => {
    expect(customerRegisterSchema.safeParse({ ...base, email: 'no-es-correo' }).success).toBe(false);
    expect(customerRegisterSchema.safeParse({ ...base, confirmPassword: 'Otra2026' }).success).toBe(false);
  });
  it('el consentimiento de promociones nunca viene marcado por defecto', () => {
    const r = customerRegisterSchema.safeParse(base);
    expect(r.success && r.data.marketingOptIn).toBe(false);
  });
});

describe('registro de compra', () => {
  it('exige clave de idempotencia válida', () => {
    expect(purchaseSchema.safeParse({ customerId: randomUUID(), stamps: 1, idempotencyKey: 'x' }).success).toBe(false);
  });
  it('importe vacío se guarda como null y negativo se rechaza', () => {
    const ok = purchaseSchema.safeParse({ customerId: randomUUID(), stamps: 1, amount: '', idempotencyKey: randomUUID() });
    expect(ok.success && ok.data.amount).toBeNull();
    expect(purchaseSchema.safeParse({ customerId: randomUUID(), stamps: 1, amount: '-3', idempotencyKey: randomUUID() }).success).toBe(false);
  });
  it('limita los sellos a 1..20', () => {
    expect(purchaseSchema.safeParse({ customerId: randomUUID(), stamps: 0, idempotencyKey: randomUUID() }).success).toBe(false);
    expect(purchaseSchema.safeParse({ customerId: randomUUID(), stamps: 21, idempotencyKey: randomUUID() }).success).toBe(false);
  });
});

describe('equipo y recompensas', () => {
  it('desde el panel solo se crean gerentes o empleados', () => {
    const base = { email: 'a@b.mx', displayName: 'Juan', password: 'Cafe2026' };
    expect(staffMemberSchema.safeParse({ ...base, role: 'owner' }).success).toBe(false);
    expect(staffMemberSchema.safeParse({ ...base, role: 'employee' }).success).toBe(true);
  });
  it('convierte límites vacíos a null', () => {
    const r = rewardSchema.safeParse({ name: 'Postre', stampsRequired: '15', isActive: true, maxPerCustomer: '', maxTotal: '' });
    expect(r.success && r.data.maxPerCustomer).toBeNull();
  });
});
