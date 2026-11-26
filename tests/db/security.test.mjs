// Pruebas obligatorias de permisos y aislamiento (consultando la "API"
// directamente, igual que lo haría PostgREST con un JWT).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, admin, as, anon, user, createAuthUser, createTenant, purchase, expectError, disableCooldown } from './helpers.mjs';

let A, B;
before(async () => {
  A = await createTenant('sec-aurora');
  B = await createTenant('sec-luna');
  await disableCooldown(A.businessId);
  await disableCooldown(B.businessId);
  await purchase(A.employee, A, A.customerId, 1, { amount: 55 });
  await purchase(B.employee, B, B.customerId, 1, { amount: 70 });
});
after(() => pool.end());

const TABLES = ['businesses', 'profiles', 'memberships', 'employees', 'customers', 'loyalty_programs',
  'loyalty_cards', 'visits', 'stamps', 'rewards', 'reward_redemptions', 'promotions', 'notifications', 'audit_logs'];

// ---------------------------------------------------------------- 1
test('1. un cliente no puede acceder a datos administrativos', async () => {
  const c = user(A.custUser);
  await expectError(as(c, `select public.get_dashboard_stats($1)`, [A.businessId]), 'FORBIDDEN');
  await expectError(as(c, `select public.get_customer_insights($1)`, [A.businessId]), 'FORBIDDEN');
  assert.equal((await as(c, `select * from public.audit_logs`)).length, 0);
  assert.equal((await as(c, `select * from public.memberships`)).length, 0);
  assert.equal((await as(c, `select * from public.employees`)).length, 0);
  assert.equal(await as(c, `select public.my_staff_role($1) as r`, [A.businessId]).then(r => r[0].r), null);

  // Solo ve su propio registro de cliente, nunca el de otros.
  const customers = await as(c, `select id from public.customers`);
  assert.deepEqual(customers.map(r => r.id), [A.customerId]);
  const overview = await as(c, `select id from public.customer_overview`);
  assert.deepEqual(overview.map(r => r.id), [A.customerId]);
  const visits = await as(c, `select customer_id from public.visits`);
  assert.ok(visits.every(v => v.customer_id === A.customerId));
});

// ---------------------------------------------------------------- 2
test('2. un cliente no puede agregar, quitar ni modificar sellos', async () => {
  const c = user(A.custUser);
  await expectError(purchase(A.custUser, A, A.customerId, 1), 'FORBIDDEN');
  await expectError(as(c, `select public.adjust_stamps($1, $2, 5, 'yo mismo')`, [A.businessId, A.customerId]), 'FORBIDDEN');
  const [card] = await admin(`select id, business_id from public.loyalty_cards where customer_id = $1`, [A.customerId]);
  await expectError(as(c, `update public.loyalty_cards set stamp_balance = 99 where id = $1`, [card.id]), /permission denied/);
  await expectError(as(c, `insert into public.stamps(business_id, card_id, customer_id, delta, balance_after, reason)
                           values ($1, $2, $3, 10, 10, 'purchase')`, [A.businessId, card.id, A.customerId]), /permission denied/);
  await expectError(as(c, `delete from public.stamps`), /permission denied/);
  await expectError(as(c, `update public.visits set stamps_awarded = 50`), /permission denied/);
  await expectError(as(c, `insert into public.rewards(business_id, name, stamps_required) values ($1, 'hack', 1)`, [A.businessId]),
    /permission denied/);
  await expectError(as(c, `select public.save_reward($1, null, 'hack', null, null, 1, true, null, null, null, null)`, [A.businessId]),
    'FORBIDDEN');
  const [after] = await admin(`select stamp_balance from public.loyalty_cards where id = $1`, [card.id]);
  assert.equal(after.stamp_balance, 1);
});

// ---------------------------------------------------------------- 3
test('3. un empleado no puede crear administradores ni tocar la configuración', async () => {
  const e = user(A.employee);
  const victim = await createAuthUser({ email: `new-staff-${randomUUID()}@test.dev` });
  await expectError(as(e, `select public.add_staff_member($1, $2, 'manager', 'X')`, [A.businessId, victim]), 'FORBIDDEN');
  await expectError(as(e, `select public.add_staff_member($1, $2, 'owner', 'X')`, [A.businessId, victim]), 'FORBIDDEN');
  await expectError(as(e, `insert into public.memberships(business_id, user_id, role) values ($1, $2, 'owner')`,
    [A.businessId, victim]), /permission denied/);
  await expectError(as(e, `update public.memberships set role = 'owner' where user_id = $1`, [A.employee]), /permission denied/);
  await expectError(as(e, `select public.update_business_settings($1,'X',null,null,'#000000','#000000',null,null,null,null,null,'UTC','MXN',30)`,
    [A.businessId]), 'FORBIDDEN');
  await expectError(as(e, `select public.update_loyalty_program($1, 'x', 5, 'y', 1, 0)`, [A.businessId]), 'FORBIDDEN');
  await expectError(as(e, `select public.get_dashboard_stats($1)`, [A.businessId]), 'FORBIDDEN');
  await expectError(as(e, `select public.adjust_stamps($1, $2, 3, 'regalo')`, [A.businessId, A.customerId]), 'FORBIDDEN');
  await expectError(as(e, `select public.create_business('hack-cafe', 'Hack', $1, 'h')`, [A.employee]), 'FORBIDDEN');
  assert.equal((await as(e, `select * from public.audit_logs`)).length, 0);

  // Ni siquiera el gerente puede crear cuentas de personal.
  await expectError(as(user(A.manager), `select public.add_staff_member($1, $2, 'employee', 'X')`, [A.businessId, victim]), 'FORBIDDEN');
  // El propietario no puede crear otro propietario desde el panel.
  await expectError(as(user(A.owner), `select public.add_staff_member($1, $2, 'owner', 'X')`, [A.businessId, victim]), 'ROLE_NOT_ALLOWED');
  // Ni degradarse / modificarse a sí mismo.
  const [own] = await admin(`select id from public.memberships where user_id = $1 and business_id = $2`, [A.owner, A.businessId]);
  await expectError(as(user(A.owner), `select public.update_staff_member($1, $2, 'employee', false, 'Yo', null, null)`,
    [A.businessId, own.id]), 'CANNOT_MODIFY_SELF');
});

test('3b. un empleado desactivado pierde el acceso de inmediato', async () => {
  const temp = await createAuthUser({ email: `temp-${randomUUID()}@test.dev` });
  const [{ m }] = await as(user(A.owner), `select public.add_staff_member($1, $2, 'employee', 'Temporal') as m`, [A.businessId, temp]);
  assert.equal((await as(user(temp), `select id from public.customers`)).length > 0, true);
  await as(user(A.owner), `select public.update_staff_member($1, $2, 'employee', false, 'Temporal', null, null)`, [A.businessId, m]);
  assert.equal((await as(user(temp), `select id from public.customers`)).length, 0);
  await expectError(purchase(temp, A, A.walkInId, 1), 'FORBIDDEN');
});

// ---------------------------------------------------------------- 4
test('4. un restaurante no puede ver ni operar datos de otro', async () => {
  for (const staff of [A.owner, A.manager, A.employee]) {
    for (const t of TABLES) {
      const rows = await as(user(staff), `select * from public.${t}`);
      for (const r of rows) {
        const bid = t === 'businesses' ? r.id : r.business_id;
        if (bid !== undefined && bid !== null) assert.notEqual(bid, B.businessId, `${t} filtra datos de otro negocio`);
      }
    }
    const ov = await as(user(staff), `select business_id from public.customer_overview`);
    assert.ok(ov.length > 0 && ov.every(r => r.business_id === A.businessId));
  }
  // Operar sobre el negocio B con credenciales de A
  await expectError(purchase(A.owner, B, B.customerId, 1), 'FORBIDDEN');
  await expectError(as(user(A.owner), `select public.get_dashboard_stats($1)`, [B.businessId]), 'FORBIDDEN');
  // Usar un cliente de B dentro del negocio A
  await expectError(purchase(A.owner, A, B.customerId, 1), 'NOT_FOUND');
  const [red] = await admin(`select id from public.reward_redemptions where business_id = $1 limit 1`, [B.businessId]);
  if (red) await expectError(as(user(A.owner), `select public.redeem_reward($1, $2)`, [A.businessId, red.id]), 'NOT_FOUND');
  // Un cliente de A no ve nada de B
  assert.equal((await as(user(A.custUser), `select * from public.rewards where business_id = $1`, [B.businessId])).length, 0);
  assert.equal((await as(user(A.custUser), `select * from public.businesses where id = $1`, [B.businessId])).length, 0);
});

// ---------------------------------------------------------------- 12
test('12. la API rechaza accesos directos sin sesión o sin permisos', async () => {
  for (const t of TABLES) {
    await expectError(as(anon, `select * from public.${t} limit 1`), /permission denied/);
  }
  await expectError(as(anon, `select * from public.customer_overview`), /permission denied/);
  await expectError(as(anon, `select public.register_purchase($1, $2, 1, null, $3)`, [A.businessId, A.customerId, randomUUID()]),
    /permission denied/);
  await expectError(as(anon, `select public.join_business('sec-aurora', 'a', 'b')`), /permission denied/);
  await expectError(as(anon, `select private.is_member($1)`, [A.businessId]), /permission denied/);
  await expectError(as(user(A.owner), `select private.sync_card_rewards($1)`, [randomUUID()]), /permission denied/);
  await expectError(as(user(A.owner), `select public.check_rate_limit('x', 1, 1)`), /permission denied/);

  // Escrituras directas prohibidas para cualquier usuario autenticado
  for (const t of TABLES) {
    await expectError(as(user(A.owner), `delete from public.${t}`), /permission denied/);
  }

  // La información pública solo expone campos seguros
  const [{ b }] = await as(anon, `select public.get_public_business('sec-aurora') as b`);
  assert.equal(b.name, 'Café sec-aurora');
  assert.equal(b.program.stamps_required, 10);
  for (const k of ['id', 'slug', 'name']) assert.ok(k in b);
  assert.ok(!('custom_domain' in b) && !('inactive_after_days' in b) && !('contact_email' in b));
  const [{ b: none }] = await as(anon, `select public.get_public_business('no-existe') as b`);
  assert.equal(none, null);
});

test('perfiles: el usuario no puede escalar a administrador de plataforma', async () => {
  await expectError(as(user(A.owner), `update public.profiles set is_platform_admin = true where id = $1`, [A.owner]),
    /permission denied/);
  // Metadatos de usuario (editables por el usuario) no otorgan tipo ni teléfono
  const id = randomUUID();
  await admin(`insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)`,
    [id, `spoof-${id}@x.dev`, { kind: 'customer', phone: A.phone1 }]);
  const [p] = await admin(`select kind, phone from public.profiles where id = $1`, [id]);
  assert.equal(p.kind, 'staff');
  assert.equal(p.phone, null);
  await expectError(as(user(id), `select public.join_business('sec-aurora', 'X', 'Y')`), 'NOT_A_CUSTOMER_ACCOUNT');
});

test('un cliente no puede leer notificaciones de otro cliente', async () => {
  const otherUser = await createAuthUser({ email: `c3@customers.test`, kind: 'customer', phone: '+5215599999999' });
  await as(user(otherUser), `select public.join_business('sec-aurora', 'Eva', 'Ruiz')`);
  const mine = await as(user(otherUser), `select customer_id from public.notifications`);
  const [{ id: evaId }] = await admin(`select id from public.customers where user_id = $1`, [otherUser]);
  assert.ok(mine.length >= 1 && mine.every(n => n.customer_id === evaId));
  const updated = await as(user(otherUser), `select public.mark_notifications_read(null) as n`);
  assert.ok(updated[0].n >= 1);
  const [{ unread }] = await admin(`select count(*)::int as unread from public.notifications where customer_id = $1 and read_at is null`,
    [A.customerId]);
  assert.ok(unread >= 1, 'no debe marcar como leídas las notificaciones de otros clientes');
});

test('auditoría: las operaciones administrativas quedan registradas', async () => {
  const logs = await as(user(A.owner), `select action, actor_id from public.audit_logs order by id`);
  const actions = logs.map(l => l.action);
  for (const a of ['business.created', 'staff.added', 'customer.self_registered', 'customer.created_by_staff', 'visit.registered']) {
    assert.ok(actions.includes(a), `falta ${a}`);
  }
  assert.ok(logs.find(l => l.action === 'visit.registered').actor_id === A.employee);
});
