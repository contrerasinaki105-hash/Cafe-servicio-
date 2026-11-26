import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000').toLowerCase();

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/recuperar', '/admin/restablecer'];
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'api', 'platform']);

// Caché corta en memoria de dominio propio -> slug (por instancia).
const domainCache = new Map<string, { slug: string | null; at: number }>();

async function resolveCustomDomain(host: string): Promise<string | null> {
  const hit = domainCache.get(host);
  if (hit && Date.now() - hit.at < 60_000) return hit.slug;
  let slug: string | null = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resolve_business_domain`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_host: host }),
    });
    if (res.ok) slug = (await res.json()) ?? null;
  } catch {
    slug = null;
  }
  domainCache.set(host, { slug, at: Date.now() });
  return slug;
}

/** Determina el negocio a partir del host: subdominio o dominio propio. */
async function tenantFromHost(rawHost: string | null): Promise<string | null> {
  if (!rawHost) return null;
  const host = rawHost.toLowerCase();
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return null;
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    if (!sub.includes('.') && !RESERVED_SUBDOMAINS.has(sub)) return sub;
    return null;
  }
  if (host.startsWith('localhost') || host.endsWith('.vercel.app') || /^\d+\.\d+\.\d+\.\d+/.test(host)) return null;
  return resolveCustomDomain(host.split(':')[0]);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenant = SUPABASE_URL ? await tenantFromHost(request.headers.get('host')) : null;

  // Dominio/subdominio de un negocio: la raíz y las rutas del portal se
  // reescriben al portal del cliente de ese negocio. /admin se mantiene.
  let rewriteTo: URL | null = null;
  if (tenant && !pathname.startsWith('/admin') && !pathname.startsWith('/auth') && !pathname.startsWith('/c/') && !pathname.startsWith('/s/')
      && !pathname.startsWith('/platform')) {
    rewriteTo = request.nextUrl.clone();
    rewriteTo.pathname = `/c/${tenant}${pathname === '/' ? '' : pathname}`;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-webya-tenant');
  if (tenant) requestHeaders.set('x-webya-tenant', tenant);

  const makeResponse = () =>
    rewriteTo
      ? NextResponse.rewrite(rewriteTo, { request: { headers: requestHeaders } })
      : NextResponse.next({ request: { headers: requestHeaders } });

  let response = makeResponse();
  if (!SUPABASE_URL || !SUPABASE_ANON) return response;

  // Refresca la sesión de Supabase (cookies httpOnly) en cada petición.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = makeResponse();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  // Primera barrera: sin sesión no se entra al panel. El layout del panel
  // vuelve a verificar la membresía y el rol en el servidor.
  const isPrivateAdmin = pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isPlatform = pathname.startsWith('/platform');
  if ((isPrivateAdmin || isPlatform) && !data.user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
