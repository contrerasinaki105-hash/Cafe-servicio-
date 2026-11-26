#!/usr/bin/env node
// Alta inicial desde la terminal (usa SUPABASE_SERVICE_ROLE_KEY de .env.local).
//
// 1) Crear tu cuenta de administrador de plataforma WebYA:
//    npm run create-business -- --platform-admin --email tu@webya.mx --password "Segura2026" --name "Tu Nombre"
//
// 2) Crear un negocio con su propietario:
//    npm run create-business -- --slug cafeaurora --business "Café Aurora" \
//       --email dueno@cafeaurora.com --password "Inicial2026" --name "María Pérez" \
//       [--domain cafeaurora.com] [--country MX] [--timezone America/Mexico_City] [--currency MXN]
import { createClient } from '@supabase/supabase-js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, []),
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}
if (!args.email || !args.password) {
  console.error('Uso: ver comentarios al inicio de scripts/create-business.mjs');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function ensureStaffUser(email, password, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { kind: 'staff', full_name: fullName },
  });
  if (data?.user) return data.user.id;
  const { data: existing } = await admin.from('profiles').select('id, kind').eq('email', email.toLowerCase()).maybeSingle();
  if (existing?.kind === 'staff') return existing.id;
  throw new Error(`No se pudo crear la cuenta: ${error?.message ?? 'desconocido'}`);
}

const userId = await ensureStaffUser(String(args.email), String(args.password), String(args.name ?? ''));

if (args['platform-admin']) {
  const { error } = await admin.from('profiles').update({ is_platform_admin: true }).eq('id', userId);
  if (error) throw error;
  console.log(`✓ ${args.email} es administrador de plataforma. Entra en /admin/login → /platform`);
}

if (args.slug) {
  const { data, error } = await admin.rpc('create_business', {
    p_slug: String(args.slug),
    p_name: String(args.business ?? args.slug),
    p_owner_user_id: userId,
    p_owner_name: String(args.name ?? 'Propietario'),
    p_country_code: String(args.country ?? 'MX'),
    p_timezone: String(args.timezone ?? 'America/Mexico_City'),
    p_currency: String(args.currency ?? 'MXN'),
    p_custom_domain: args.domain ? String(args.domain) : null,
  });
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  console.log(`✓ Negocio creado (${data}). Portal: /c/${args.slug} · Panel: /admin`);
}
