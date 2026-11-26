// Pruebas de operaciones críticas: visitas, sellos, duplicados, canjes,
// recompensas por niveles, promociones y estadísticas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, admin, as, user, createAuthUser, createTenant, purchase, expectError, disableCooldown } from './helpers.mjs';

let T;
before(async () => { T = await createTenant('ops-valle'); });
after(() => pool.end());

const balance = async (customerId) =>
  (await admin(`select stamp_balance from public.loyalty_cards where customer_id = $1`, [customerId]))[0]?.stamp_balance ?? 0;

// ---------------------------------------------------------------- 7
test('7. las visitas se registran con cliente, empleado, fecha, sellos e importe', async () => {
  const key = randomUUID();
  const r = await purchase(T.employee, T, T.customerId, 1, { amount: 85.5, key });
  assert.equal(r.duplicate, false);
  assert.equal(r.stamp_balance, 1);
  const [v] = await admin(`select * from public.visits where id = $1`, [r.visit_id]);
  assert.equal(v.customer_id, T.customerId);
  assert.equal(v.recorded_by, T.employee);
  assert.equal(v.business_id, T.businessId);
  assert.equal(v.stamps_awarded, 1);
  assert.equal(Number(v.amount), 85.5);
  assert.equal(v.idempotency_key, key);
  assert.ok(v.created_at instanceof Date);
  const [s] = await admin(`select * from public.stamps where visit_id = $1`, [r.visit_id]);
  assert.equal(s.delta, 1);
  assert.equal(s.balance_after, 1);
  assert.equal(s.created_by, T.employee);
  assert.equal(s.reason, 'purchase');
});

// ---------------------------------------------------------------- 8
test('8. no se duplican sellos: idempotencia, concurrencia y enfriamiento', async () => {
  const before = await balance(T.customerId);
  // Reintento con la misma clave (doble clic, red inestable)
  const key = randomUUID();
  await expectError(purchase(T.employee, T, T.customerId, 1, { key }), 'COOLDOWN_ACTIVE');
  await disableCooldown(T.businessId);
  const first = await purchase(T.employee, T, T.customerId, 1, { key });
  const again = await purchase(T.employee, T, T.customerId, 1, { key });
  assert.equal(first.duplicate, false);
  assert.equal(again.duplicate, true);
  assert.equal(await balance(T.customerId), before + 1);

  // 8 solicitudes simultáneas con la misma clave => un solo sello
  const key2 = randomUUID();
  const results = await Promise.allSettled(Array.from({ length: 8 }, () =>
    purchase(T.employee, T, T.customerId, 1, { key: key2 })));
  const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  assert.equal(ok.filter(r => !r.duplicate).length, 1);
  assert.equal(await balance(T.customerId), before + 2);
  const [{ n }] = await admin(`select count(*)::int as n from public.visits where idempotency_key = $1`, [key2]);
  assert.equal(n, 1);

  // Enfriamiento: dos compras distintas en pocos minutos se bloquean
  await admin(`update public.loyalty_programs set cooldown_minutes = 5 where business_id = $1`, [T.businessId]);
  await expectError(purchase(T.employee, T, T.customerId, 1), 'COOLDOWN_ACTIVE');
  // El empleado no puede forzarlo; el gerente sí (operación autorizada)
  await expectError(purchase(T.employee, T, T.customerId, 1, { override: true }), 'COOLDOWN_ACTIVE');
  const forced = await purchase(T.manager, T, T.customerId, 1, { override: true });
  assert.equal(forced.duplicate, false);
  await disableCooldown(T.businessId);

  // Límite de sellos por visita para empleados
  await expectError(purchase(T.employee, T, T.walkInId, 2), 'INVALID_STAMP_COUNT');
  await expectError(purchase(T.employee, T, T.walkInId, 0), 'INVALID_STAMP_COUNT');
  await expectError(purchase(T.employee, T, T.walkInId, 1, { amount: -5 }), 'INVALID_AMOUNT');
});

test('clientes bloqueados no acumulan sellos', async () => {
  const [{ id }] = await as(user(T.employee),
    `select public.staff_create_customer($1, 'Bloq', 'Ueado', '+5215511112222') as id`, [T.businessId]);
  await as(user(T.manager), `select public.update_customer($1, $2, 'Bloq', 'Ueado', null, 'fraude', 'blocked')`, [T.businessId, id]);
  await expectError(purchase(T.employee, T, id, 1), 'CUSTOMER_BLOCKED');
  await expectError(as(user(T.employee), `select public.staff_create_customer($1, 'X', 'Y', '+5215511112222')`, [T.businessId]),
    'PHONE_ALREADY_REGISTERED');
});

// ---------------------------------------------------------------- 9
test('9. las recompensas se emiten automáticamente y se canjean una sola vez', async () => {
  await disableCooldown(T.businessId);
  const cust = T.walkInId;
  for (let i = 0; i < 9; i++) await purchase(T.employee, T, cust, 1);
  let vouchers = await admin(`select * from public.reward_redemptions where customer_id = $1`, [cust]);
  assert.equal(vouchers.length, 0, 'con 9 sellos aún no hay recompensa');

  const r = await purchase(T.employee, T, cust, 1);
  assert.equal(r.new_rewards, 1);
  vouchers = await admin(`select * from public.reward_redemptions where customer_id = $1 and status = 'available'`, [cust]);
  assert.equal(vouchers.length, 1);
  const voucher = vouchers[0];
  const [notif] = await admin(`select * from public.notifications where customer_id = $1 and kind = 'reward_available'`, [cust]);
  assert.ok(notif, 'se notifica al cliente');

  // Dos cajas intentando canjear la misma recompensa al mismo tiempo
  const attempts = await Promise.allSettled([
    as(user(T.employee), `select public.redeem_reward($1, $2) as r`, [T.businessId, voucher.id]),
    as(user(T.manager), `select public.redeem_reward($1, $2) as r`, [T.businessId, voucher.id]),
    as(user(T.owner), `select public.redeem_reward($1, $2) as r`, [T.businessId, voucher.id]),
  ]);
  const won = attempts.filter(a => a.status === 'fulfilled');
  assert.equal(won.length, 1, 'solo un canje puede tener éxito');
  for (const a of attempts.filter(a => a.status === 'rejected')) assert.match(a.reason.message, /ALREADY_REDEEMED/);
  await expectError(as(user(T.employee), `select public.redeem_reward($1, $2)`, [T.businessId, voucher.id]), 'ALREADY_REDEEMED');

  assert.equal(await balance(cust), 0);
  const [red] = await admin(`select * from public.reward_redemptions where id = $1`, [voucher.id]);
  assert.equal(red.status, 'redeemed');
  assert.ok(red.redeemed_by && red.redeemed_at);
  const ledger = await admin(`select delta from public.stamps where redemption_id = $1`, [voucher.id]);
  assert.deepEqual(ledger.map(l => l.delta), [-10]);
  // El cliente no puede canjear por sí mismo
  await expectError(as(user(T.custUser), `select public.redeem_reward($1, $2)`, [T.businessId, voucher.id]), 'FORBIDDEN');
});

test('recompensas por niveles (10 / 15 / 20) con anulación cuando ya no alcanzan', async () => {
  const o = user(T.owner);
  const [{ id: dessert }] = await as(o, `select public.save_reward($1, null, 'Postre gratis', null, null, 15, true, null, null, null, null) as id`, [T.businessId]);
  await as(o, `select public.save_reward($1, null, '20% de descuento', null, null, 20, true, null, null, 1, null)`, [T.businessId]);
  await expectError(as(user(T.manager), `select public.save_reward($1, null, 'x', null, null, 5, true, null, null, null, null)`, [T.businessId]), 'FORBIDDEN');

  const [{ id: cust }] = await as(user(T.employee),
    `select public.staff_create_customer($1, 'Niv', 'Eles', '+5215533334444') as id`, [T.businessId]);
  await as(user(T.owner), `select public.adjust_stamps($1, $2, 20, 'Migración de tarjeta física')`, [T.businessId, cust]);
  let avail = await admin(`select r.name from public.reward_redemptions rr join public.rewards r on r.id = rr.reward_id
                           where rr.customer_id = $1 and rr.status = 'available' order by rr.stamps_cost`, [cust]);
  assert.deepEqual(avail.map(a => a.name), ['Café gratis', 'Postre gratis', '20% de descuento']);

  // Canjear el postre (15) deja 5: las demás ya no alcanzan y se anulan
  const [v] = await admin(`select id from public.reward_redemptions where customer_id = $1 and reward_id = $2 and status = 'available'`,
    [cust, dessert]);
  await as(user(T.employee), `select public.redeem_reward($1, $2)`, [T.businessId, v.id]);
  assert.equal(await balance(cust), 5);
  avail = await admin(`select id from public.reward_redemptions where customer_id = $1 and status = 'available'`, [cust]);
  assert.equal(avail.length, 0);

  // Corrección negativa por debajo de cero: rechazada
  await expectError(as(user(T.manager), `select public.adjust_stamps($1, $2, -6, 'error de caja')`, [T.businessId, cust]), 'INSUFFICIENT_BALANCE');
  await expectError(as(user(T.manager), `select public.adjust_stamps($1, $2, -1, '')`, [T.businessId, cust]), 'REASON_REQUIRED');
  const [{ r }] = await as(user(T.manager), `select public.adjust_stamps($1, $2, -2, 'sello registrado por error') as r`, [T.businessId, cust]);
  assert.equal(r.stamp_balance, 3);
  const [log] = await admin(`select * from public.stamps where customer_id = $1 and reason = 'correction' order by created_at desc limit 1`, [cust]);
  assert.equal(log.created_by, T.manager);
  assert.equal(log.note, 'sello registrado por error');
});

test('límite de canjes por cliente y desactivación de recompensas', async () => {
  const [{ id: cust }] = await as(user(T.employee),
    `select public.staff_create_customer($1, 'Lim', 'Ite', '+5215555556666') as id`, [T.businessId]);
  const [disc] = await admin(`select id from public.rewards where business_id = $1 and name = '20% de descuento'`, [T.businessId]);
  await as(user(T.owner), `select public.adjust_stamps($1, $2, 40, 'carga')`, [T.businessId, cust]);
  const [v] = await admin(`select id from public.reward_redemptions where customer_id = $1 and reward_id = $2 and status = 'available'`, [cust, disc.id]);
  await as(user(T.employee), `select public.redeem_reward($1, $2)`, [T.businessId, v.id]);
  // Tras el canje quedan 20 sellos, pero el límite por cliente es 1
  const again = await admin(`select id from public.reward_redemptions where customer_id = $1 and reward_id = $2 and status = 'available'`, [cust, disc.id]);
  assert.equal(again.length, 0);

  // Desactivar una recompensa anula las disponibles
  const [dessert] = await admin(`select id from public.rewards where business_id = $1 and name = 'Postre gratis'`, [T.businessId]);
  assert.equal((await admin(`select 1 from public.reward_redemptions where reward_id = $1 and customer_id = $2 and status='available'`, [dessert.id, cust])).length, 1);
  const [{ r }] = await as(user(T.owner), `select public.delete_reward($1, $2) as r`, [T.businessId, dessert.id]);
  assert.equal(r, 'deactivated', 'con historial de canjes solo se desactiva');
  assert.equal((await admin(`select 1 from public.reward_redemptions where reward_id = $1 and customer_id = $2 and status='available'`, [dessert.id, cust])).length, 0);
  // La recompensa base no se puede borrar
  const [prog] = await admin(`select base_reward_id from public.loyalty_programs where business_id = $1`, [T.businessId]);
  await expectError(as(user(T.owner), `select public.delete_reward($1, $2)`, [T.businessId, prog.base_reward_id]), 'BASE_REWARD_CANNOT_BE_DELETED');
});

test('configurar el programa cambia los sellos necesarios y re-sincroniza tarjetas', async () => {
  const [{ id: cust }] = await as(user(T.employee),
    `select public.staff_create_customer($1, 'Pro', 'Grama', '+5215577778888') as id`, [T.businessId]);
  await as(user(T.owner), `select public.adjust_stamps($1, $2, 8, 'carga')`, [T.businessId, cust]);
  assert.equal((await admin(`select 1 from public.reward_redemptions where customer_id = $1 and status='available'`, [cust])).length, 0);
  await as(user(T.owner), `select public.update_loyalty_program($1, 'Club Café', 8, 'Capuchino gratis', 2, 0)`, [T.businessId]);
  const avail = await admin(`select r.name, rr.stamps_cost from public.reward_redemptions rr join public.rewards r on r.id = rr.reward_id
                             where rr.customer_id = $1 and rr.status='available'`, [cust]);
  assert.deepEqual(avail.map(a => [a.name, a.stamps_cost]), [['Capuchino gratis', 8]]);
  // Ahora el empleado puede dar hasta 2 sellos por visita
  const r = await purchase(T.employee, T, T.walkInId, 2);
  assert.equal(r.duplicate, false);
  await as(user(T.owner), `select public.update_loyalty_program($1, 'Club Café', 10, 'Café gratis', 1, 0)`, [T.businessId]);
});

test('el cliente que se registra con un teléfono dado de alta en mostrador hereda sus sellos', async () => {
  const phone = '+5215512340000';
  const [{ id: walk }] = await as(user(T.employee),
    `select public.staff_create_customer($1, 'Mos', 'Trador', $2) as id`, [T.businessId, phone]);
  await purchase(T.employee, T, walk, 1);
  const u = await createAuthUser({ email: 'claim@customers.test', kind: 'customer', phone });
  const [{ id }] = await as(user(u), `select public.join_business('ops-valle', 'Mos', 'Trador', null, false) as id`);
  assert.equal(id, walk);
  assert.equal(await balance(walk), 1);
  // Otra cuenta con el mismo teléfono no puede apropiarse del cliente
  const [{ id: same }] = await as(user(u), `select public.join_business('ops-valle', 'Mos', 'Trador') as id`);
  assert.equal(same, walk);
});

test('promociones: respetan consentimiento, segmentos y se envían una sola vez', async () => {
  const m = user(T.manager);
  await expectError(as(user(T.employee), `select public.save_promotion($1, null, 'Promo', null, 'discount', 'all', 10, null, null, null, true)`,
    [T.businessId]), 'FORBIDDEN');
  const [{ id }] = await as(m, `select public.save_promotion($1, null, 'Doble sello martes', 'Ven el martes', 'frequent', 'all', null, 1, null, null, true) as id`,
    [T.businessId]);
  const optIn = await admin(`select id from public.customers where business_id = $1 and marketing_opt_in and status = 'active'`, [T.businessId]);
  const active = await admin(`select id from public.customers where business_id = $1 and status = 'active'`, [T.businessId]);
  const [{ r }] = await as(m, `select public.send_promotion($1, $2) as r`, [T.businessId, id]);
  assert.equal(r.notified, optIn.length, 'solo clientes con consentimiento reciben la comunicación');
  assert.equal(r.bonus_customers, active.length);
  const sent = await admin(`select customer_id from public.notifications where promotion_id = $1 and channel = 'in_app'`, [id]);
  const optInIds = new Set(optIn.map(c => c.id));
  assert.ok(sent.every(s => optInIds.has(s.customer_id)));
  await expectError(as(m, `select public.send_promotion($1, $2)`, [T.businessId, id]), 'ALREADY_SENT');

  // El cliente puede dejar de recibir comunicaciones
  await as(user(T.custUser), `select public.set_marketing_consent($1, false)`, [T.businessId]);
  const [c] = await admin(`select marketing_opt_in from public.customers where id = $1`, [T.customerId]);
  assert.equal(c.marketing_opt_in, false);
  // y ve las promociones vigentes de su negocio
  const promos = await as(user(T.custUser), `select title from public.promotions`);
  assert.ok(promos.some(p => p.title === 'Doble sello martes'));
});

// ---------------------------------------------------------------- 10
test('10. las estadísticas coinciden con la base de datos', async () => {
  const [{ s }] = await as(user(T.manager), `select public.get_dashboard_stats($1, 6) as s`, [T.businessId]);
  const q = async (sql) => (await admin(sql, [T.businessId]))[0].n;
  assert.equal(s.total_customers, await q(`select count(*)::int n from public.customers where business_id = $1`));
  assert.equal(s.total_visits, await q(`select count(*)::int n from public.visits where business_id = $1`));
  assert.equal(Number(s.total_stamps), await q(`select coalesce(sum(delta),0)::int n from public.stamps where business_id = $1 and reason in ('purchase','bonus','promotion')`));
  assert.equal(s.redeemed_rewards, await q(`select count(*)::int n from public.reward_redemptions where business_id = $1 and status = 'redeemed'`));
  assert.equal(s.available_rewards, await q(`select count(*)::int n from public.reward_redemptions where business_id = $1 and status = 'available'`));
  assert.equal(s.active_customers, await q(`select count(distinct customer_id)::int n from public.visits where business_id = $1 and created_at > now() - interval '30 days'`));
  assert.equal(s.new_customers_month, s.total_customers, 'todos se crearon este mes');
  const monthVisits = s.visits_by_week.reduce((a, w) => a + w.value, 0);
  assert.equal(monthVisits, s.total_visits);
  assert.equal(s.activity_by_hour.length, 24);
  assert.equal(s.activity_by_hour.reduce((a, h) => a + h.value, 0), s.total_visits);
  assert.equal(s.customers_by_month.length, 6);
  assert.equal(s.customers_by_month.at(-1).value, s.total_customers);
  assert.ok(s.top_customers.length > 0 && s.top_customers.length <= 5);

  const [{ i }] = await as(user(T.owner), `select public.get_customer_insights($1, 30, 3, 10) as i`, [T.businessId]);
  assert.equal(i.period_days, 30);
  assert.equal(i.counts.new, s.total_customers - (await q(`select count(*)::int n from public.customers where business_id = $1 and status <> 'active'`)));
  assert.equal(i.counts.inactive, 0, 'nadie es inactivo dentro de un periodo de 30 días');
  const [{ i: short }] = await as(user(T.owner), `select public.get_customer_insights($1, 1, 3, 10) as i`, [T.businessId]);
  assert.equal(short.period_days, 1);

  // Clientes sin visitas en el periodo configurable => inactivos
  await admin(`update public.customers set created_at = now() - interval '90 days' where business_id = $1`, [T.businessId]);
  await admin(`update public.visits set created_at = now() - interval '60 days' where business_id = $1`, [T.businessId]);
  const [{ i: old }] = await as(user(T.owner), `select public.get_customer_insights($1, 30, 3, 50) as i`, [T.businessId]);
  assert.equal(old.counts.inactive, i.counts.new);
  const [{ i: wide }] = await as(user(T.owner), `select public.get_customer_insights($1, 120, 3, 50) as i`, [T.businessId]);
  assert.equal(wide.counts.inactive, 0, 'con un periodo de 120 días ya no son inactivos');
});
