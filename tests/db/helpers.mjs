import pg from 'pg';
import { randomUUID } from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL no definido: ejecuta ./scripts/test-db.sh');

export const pool = new pg.Pool({ connectionString: url, max: 10 });

/** Ejecuta SQL como superusuario (preparación de datos). */
export async function admin(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

/**
 * Ejecuta SQL con la identidad de un rol de Supabase, igual que PostgREST:
 * SET ROLE + claims del JWT en request.jwt.claims.
 * who: { role: 'anon' } | { role: 'authenticated', id } | { role: 'service_role' }
 */
export async function as(who, sql, params = [], client = null) {
  const c = client ?? (await pool.connect());
  try {
    await c.query('begin');
    await c.query(`select set_config('role', $1, true)`, [who.role]);
    const claims = JSON.stringify({ role: who.role, ...(who.id ? { sub: who.id } : {}) });
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    const { rows } = await c.query(sql, params);
    await c.query('commit');
    return rows;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    if (!client) c.release();
  }
}

export const anon = { role: 'anon' };
export const service = { role: 'service_role' };
export const user = (id) => ({ role: 'authenticated', id });

export async function createAuthUser({ email, kind = 'staff', phone = null, fullName = null }) {
  const id = randomUUID();
  const meta = { kind, ...(phone ? { phone } : {}), ...(fullName ? { full_name: fullName } : {}) };
  await admin(`insert into auth.users(id, email, raw_app_meta_data) values ($1, $2, $3)`, [id, email, meta]);
  return id;
}

let seq = Math.floor(Math.random() * 900) + 100;
/** Crea un negocio completo con propietario, gerente, empleado y clientes. */
export async function createTenant(slug) {
  seq += 1;
  const owner = await createAuthUser({ email: `owner-${slug}@test.dev`, fullName: `Owner ${slug}` });
  const manager = await createAuthUser({ email: `manager-${slug}@test.dev` });
  const employee = await createAuthUser({ email: `employee-${slug}@test.dev` });
  const [{ id: businessId }] = await as(service,
    `select public.create_business($1, $2, $3, $4) as id`, [slug, `Café ${slug}`, owner, `Owner ${slug}`]);
  await as(user(owner), `select public.add_staff_member($1, $2, 'manager', 'Gerente')`, [businessId, manager]);
  await as(user(owner), `select public.add_staff_member($1, $2, 'employee', 'Empleado')`, [businessId, employee]);

  const phone1 = `+5215${seq}${String(Date.now() % 100000).padStart(5, '0')}1`;
  const phone2 = `+5215${seq}${String(Date.now() % 100000).padStart(5, '0')}2`;
  const custUser = await createAuthUser({ email: `c1-${slug}@customers.test`, kind: 'customer', phone: phone1 });
  const [{ id: customerId }] = await as(user(custUser),
    `select public.join_business($1, 'Ana', 'López', 'ana@mail.com', true) as id`, [slug]);
  const [{ id: walkInId }] = await as(user(employee),
    `select public.staff_create_customer($1, 'Luis', 'Pérez', $2, null, false) as id`, [businessId, phone2]);

  return { slug, businessId, owner, manager, employee, custUser, customerId, walkInId, phone1, phone2 };
}

export async function purchase(staffId, t, customerId, stamps = 1, opts = {}) {
  const [{ r }] = await as(user(staffId),
    `select public.register_purchase($1, $2, $3, $4, $5, null, $6) as r`,
    [t.businessId, customerId, stamps, opts.amount ?? null, opts.key ?? randomUUID(), opts.override ?? false]);
  return r;
}

/** Desactiva el enfriamiento del programa (para pruebas que encadenan compras). */
export async function disableCooldown(businessId) {
  await admin(`update public.loyalty_programs set cooldown_minutes = 0 where business_id = $1`, [businessId]);
}

export async function expectError(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    if (pattern && !(pattern instanceof RegExp ? pattern.test(e.message) : e.message.includes(pattern))) {
      throw new Error(`Se esperaba error ${pattern}, se obtuvo: ${e.message}`);
    }
    return e;
  }
  throw new Error(`Se esperaba error ${pattern ?? ''} pero la operación tuvo éxito`);
}
