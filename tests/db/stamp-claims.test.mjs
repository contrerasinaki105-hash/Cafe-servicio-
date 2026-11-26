// QR de sello de un solo uso: el personal lo genera, el cliente lo escanea.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, admin, as, anon, user, createAuthUser, createTenant, expectError, disableCooldown } from './helpers.mjs';

let T, O;
before(async () => {
  T = await createTenant('qr-eco');
  O = await createTenant('qr-otro');
  await disableCooldown(T.businessId);
});
after(() => pool.end());

const create = (staff, t, stamps = 1, amount = null) =>
  as(user(staff), `select public.create_stamp_claim($1, $2, $3) as r`, [t.businessId, stamps, amount]).then((r) => r[0].r);
const claim = (uid, token) => as(user(uid), `select public.claim_stamps($1) as r`, [token]).then((r) => r[0].r);
const balance = async (id) => (await admin(`select stamp_balance from public.loyalty_cards where customer_id = $1`, [id]))[0]?.stamp_balance ?? 0;

test('el cliente recibe el sello al escanear el QR del personal, una sola vez', async () => {
  const before = await balance(T.customerId);
  const c = await create(T.employee, T, 1, 75);
  assert.match(c.token, /^[a-f0-9]{36}$/);
  const r = await claim(T.custUser, c.token);
  assert.equal(r.duplicate, false);
  assert.equal(r.slug, 'qr-eco');
  assert.equal(await balance(T.customerId), before + 1);

  // Trazabilidad: la visita y el sello quedan a nombre del empleado que generó el QR
  const [v] = await admin(`select recorded_by, amount from public.visits where idempotency_key = $1`, [c.id]);
  assert.equal(v.recorded_by, T.employee);
  assert.equal(Number(v.amount), 75);
  const [st] = await as(user(T.employee), `select public.get_stamp_claim_status($1, $2) as s`, [T.businessId, c.id]);
  assert.equal(st.s.status, 'claimed');
  assert.equal(st.s.customer_name, 'Ana López');

  // Reabrir el enlace no duplica; otro cliente no puede reutilizarlo
  const again = await claim(T.custUser, c.token);
  assert.equal(again.duplicate, true);
  assert.equal(await balance(T.customerId), before + 1);
  const other = await createAuthUser({ email: 'qr-other@customers.test', kind: 'customer', phone: '+5215566600000' });
  await as(user(other), `select public.join_business('qr-eco', 'Otro', 'Cliente')`);
  await expectError(claim(other, c.token), 'CODE_ALREADY_USED');
});

test('dos teléfonos escaneando el mismo QR a la vez: solo uno recibe el sello', async () => {
  const u2 = await createAuthUser({ email: 'qr-race@customers.test', kind: 'customer', phone: '+5215566600001' });
  const [{ id: c2 }] = await as(user(u2), `select public.join_business('qr-eco', 'Race', 'Dos') as id`);
  const c = await create(T.employee, T, 1);
  const res = await Promise.allSettled([claim(T.custUser, c.token), claim(u2, c.token)]);
  assert.equal(res.filter((r) => r.status === 'fulfilled' && !r.value.duplicate).length, 1);
  const [{ n }] = await admin(`select count(*)::int n from public.visits where idempotency_key = $1`, [c.id]);
  assert.equal(n, 1);
  void c2;
});

test('el QR caduca, se puede cancelar y no sirve en otro negocio', async () => {
  const c = await create(T.employee, T, 1);
  await admin(`update public.stamp_claims set expires_at = now() - interval '1 second' where id = $1`, [c.id]);
  await expectError(claim(T.custUser, c.token), 'CODE_EXPIRED');
  const [{ s }] = await as(user(T.employee), `select public.get_stamp_claim_status($1, $2) as s`, [T.businessId, c.id]);
  assert.equal(s.status, 'expired');

  const c2 = await create(T.employee, T, 1);
  await as(user(T.employee), `select public.cancel_stamp_claim($1, $2)`, [T.businessId, c2.id]);
  await expectError(claim(T.custUser, c2.token), 'CODE_CANCELLED');

  // Cliente de otro negocio: debe registrarse en este negocio primero
  const c3 = await create(T.employee, T, 1);
  await expectError(claim(O.custUser, c3.token), 'NOT_REGISTERED');
  await expectError(claim(T.custUser, 'f'.repeat(36)), 'INVALID_CODE');
});

test('respeta el enfriamiento, los límites de sellos y los permisos', async () => {
  await admin(`update public.loyalty_programs set cooldown_minutes = 5 where business_id = $1`, [T.businessId]);
  const c = await create(T.employee, T, 1);
  await expectError(claim(T.custUser, c.token), 'COOLDOWN_ACTIVE');
  const [row] = await admin(`select status from public.stamp_claims where id = $1`, [c.id]);
  assert.equal(row.status, 'pending', 'un intento fallido no consume el QR');
  await disableCooldown(T.businessId);

  await expectError(create(T.employee, T, 2), 'INVALID_STAMP_COUNT');
  assert.equal((await create(T.manager, T, 3)).stamps, 3);
  // Un cliente no puede generar QR de sellos para sí mismo
  await expectError(create(T.custUser, T, 1), 'FORBIDDEN');
  // El personal de otro negocio tampoco
  await expectError(create(O.owner, T, 1), 'FORBIDDEN');
  await expectError(as(user(O.owner), `select public.get_stamp_claim_status($1, $2)`, [T.businessId, c.id]), 'FORBIDDEN');
  // Nadie lee los códigos directamente desde la API
  await expectError(as(anon, `select token from public.stamp_claims`), /permission denied/);
  assert.equal((await as(user(T.custUser), `select token from public.stamp_claims`)).length, 0);
  assert.equal((await as(user(O.owner), `select token from public.stamp_claims`)).filter(Boolean).length, 0);
  await expectError(as(user(T.custUser), `update public.stamp_claims set status = 'pending'`), /permission denied/);

  // El cliente bloqueado no puede canjear
  const c4 = await create(T.employee, T, 1);
  await as(user(T.manager), `select public.update_customer($1, $2, 'Ana', 'López', null, null, 'blocked')`, [T.businessId, T.customerId]);
  await expectError(claim(T.custUser, c4.token), 'CUSTOMER_BLOCKED');
});

test('la información pública del QR no expone datos sensibles', async () => {
  const c = await create(T.employee, T, 1);
  const [{ p }] = await as(anon, `select public.get_stamp_claim_public($1) as p`, [c.token]);
  assert.deepEqual(Object.keys(p).sort(), ['name', 'slug', 'stamps', 'valid']);
  assert.equal(p.valid, true);
  await expectError(as(anon, `select public.claim_stamps($1)`, [c.token]), /permission denied/);
});
