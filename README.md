# WebYA Loyalty System

Plataforma multiempresa de fidelización y administración de clientes para cafeterías y restaurantes.

- **Portal del cliente** (`/c/{negocio}`): registro por QR, tarjeta digital de sellos, recompensas, historial y notificaciones. Funciona en el navegador del teléfono, sin instalar apps.
- **Panel privado** (`/admin`): dashboard, registrar compra (búsqueda por teléfono, nombre o QR con cámara), clientes, sellos, recompensas, promociones, análisis, equipo, registro de actividad y configuración.
- **Plataforma WebYA** (`/platform`): alta de nuevos negocios (solo administradores de plataforma).

Stack: Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, RLS, Storage) · Vercel.

---

## Arquitectura

```
src/
  proxy.ts                 Sesión Supabase + resolución de negocio por dominio/subdominio + primera barrera de /admin
  app/
    admin/login|recuperar|restablecer|sin-acceso   Acceso del personal
    admin/(panel)/...      Panel protegido (layout verifica membresía y rol en servidor)
    c/[slug]/...           Portal del cliente
    platform/              Alta de negocios (WebYA)
    auth/callback          Intercambio del enlace de recuperación de contraseña
  server/                  Server Actions (validación zod + llamadas a funciones de la BD)
  lib/                     Clientes Supabase, contexto de sesión, validación, utilidades
  components/              UI reutilizable (ui/), panel (admin/), portal (portal/)
supabase/migrations/       Esquema, lógica de negocio (funciones SQL), RLS y Storage
tests/db/                  Pruebas de seguridad y operaciones críticas contra PostgreSQL real
tests/unit/                Pruebas unitarias (validación, teléfonos, errores)
```

### Modelo de seguridad

| Capa | Qué hace |
|---|---|
| Proxy | Sin sesión no se entra a `/admin` ni `/platform`. |
| Layout del panel | Exige membresía **activa** en un negocio **activo**; cada página exige su rol. |
| Server Actions | Validan datos con zod y vuelven a comprobar el rol. |
| Base de datos | **RLS en las 14 tablas.** El navegador solo tiene `SELECT` filtrado. **Ninguna escritura directa**: sellos, visitas, canjes, equipo, recompensas, etc. pasan por funciones `SECURITY DEFINER` que identifican al usuario con `auth.uid()`, validan su rol en el `business_id`, bloquean filas y dejan auditoría. |

- Aislamiento multiempresa en la BD: todo registro lleva `business_id` y cada política exige pertenencia a ese negocio.
- Sellos: libro mayor inmutable (`stamps`) con responsable, fecha, motivo y saldo resultante. Idempotencia por `idempotency_key` única + bloqueo de la tarjeta (`FOR UPDATE`) + enfriamiento configurable entre compras.
- Canjes: transición `available → redeemed` con bloqueo de fila; un segundo intento falla con `ALREADY_REDEEMED`.
- `kind` (cliente/personal) y teléfono del perfil se leen de `app_metadata`, que solo el servidor puede escribir.
- La clave `service_role` solo existe en el servidor (`src/lib/supabase/admin.ts`, marcado `server-only`). Se usa únicamente para crear cuentas de Auth, restablecer contraseñas de clientes, subir imágenes y el límite de intentos.
- Límite de intentos en login, registro y recuperación (tabla en esquema privado).
- Cabeceras de seguridad (HSTS, X-Frame-Options, nosniff, Referrer-Policy).

### Roles

| | Administrador principal | Gerente | Empleado |
|---|:-:|:-:|:-:|
| Registrar compras, buscar clientes, confirmar canjes | ✓ | ✓ | ✓ |
| Más sellos que el máximo por visita / autorizar compra en enfriamiento | ✓ | ✓ | — |
| Dashboard, análisis, promociones, corregir sellos, editar clientes | ✓ | ✓ | — |
| Recompensas y programa (editar) | ✓ | solo ver | — |
| Equipo, configuración, registro de actividad | ✓ | — | — |

### Recompensas

Los sellos se acumulan como saldo. Cada recompensa activa cuyo umbral alcanza el cliente se **emite automáticamente** (y se le notifica). Al canjear, se descuentan los sellos; las recompensas que dejan de alcanzarse se anulan solas. Ejemplo: 10 = café, 15 = postre, 20 = 20 % de descuento.

### Clientes: inicio de sesión

Teléfono + contraseña. Supabase Auth necesita un identificador, así que se usa un correo interno derivado del teléfono (`tel-52155…@CUSTOMER_AUTH_EMAIL_DOMAIN`); nunca se le envían correos. Si el cliente olvida su contraseña, un gerente la restablece desde su perfil (queda auditado). **Limitación:** el teléfono no se verifica por SMS. Para verificarlo hace falta un proveedor SMS (p. ej. Twilio) y cambiar a OTP.

---

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Aplica las migraciones en orden (`supabase/migrations/*.sql`):
   - con la CLI: `supabase link --project-ref <ref>` y luego `supabase db push`, **o**
   - pegando cada archivo en *SQL Editor*, en orden.
3. *Authentication → Providers → Email*: deja Email activo y **desactiva "Allow new users to sign up"** (todas las cuentas las crea el servidor).
4. *Authentication → URL Configuration*:
   - Site URL: `https://tu-dominio`
   - Redirect URLs: `https://tu-dominio/auth/callback` (y los dominios propios de cada negocio).
5. *Authentication → SMTP*: configura un SMTP propio (Resend, SendGrid, etc.). El SMTP incluido en Supabase tiene un límite muy bajo y no sirve en producción para la recuperación de contraseñas.
6. *Storage*: la migración `…004_storage.sql` crea el bucket público `business-assets` (logotipos y fotos de recompensas).

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores de *Project Settings → API*:

| Variable | Dónde |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Públicas |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta**, solo servidor |
| `NEXT_PUBLIC_SITE_URL` | URL pública principal |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Dominio raíz para subdominios (`cafeaurora.tudominio.com`) |
| `CUSTOMER_AUTH_EMAIL_DOMAIN` | Dominio interno de identidad de clientes (no necesita buzón) |

### 3. Primer acceso

```bash
npm install
# Tu cuenta de administrador de plataforma
npm run create-business -- --platform-admin --email tu@webya.mx --password "Segura2026" --name "Tu Nombre"
# Un negocio con su propietario (también puedes hacerlo desde /platform)
npm run create-business -- --slug cafeaurora --business "Café Aurora" --email dueno@cafeaurora.com --password "Inicial2026" --name "María Pérez"
npm run dev
```

### 4. Vercel

1. Importa el repositorio en Vercel (framework: Next.js).
2. Añade las mismas variables de entorno (la `SUPABASE_SERVICE_ROLE_KEY` sin prefijo `NEXT_PUBLIC_`).
3. Dominios:
   - **Subdominios**: añade `*.tudominio.com` (wildcard) en Vercel y en el DNS.
   - **Dominio propio por negocio** (`cafeaurora.com`): añádelo en Vercel, apunta su DNS y escríbelo en el campo *Dominio propio* al crear el negocio. `cafeaurora.com` muestra el portal y `cafeaurora.com/admin` el panel con la marca del negocio.
   - Sin dominio: el portal funciona en `tudominio.com/c/cafeaurora`.

---

## Pruebas

```bash
npm run test:unit   # validación, teléfonos, errores (vitest)
npm run test:db     # levanta PostgreSQL 16 efímero, aplica migraciones y prueba RLS + operaciones
npm run typecheck && npm run lint && npm run build
```

`test:db` necesita los binarios de PostgreSQL (`initdb`, `pg_ctl`, `psql`). Simula los roles y `auth.uid()` de Supabase (`supabase/tests/supabase-shim.sql`) y llama a la base de datos igual que PostgREST (rol + claims del JWT). Cubre:

1. Un cliente no accede a datos administrativos · 2. un cliente no puede agregar ni modificar sellos · 3. un empleado no puede crear administradores ni tocar la configuración (y un empleado desactivado pierde el acceso) · 4. aislamiento total entre negocios · 7. registro correcto de visitas · 8. sin sellos duplicados (reintentos, 8 peticiones simultáneas, enfriamiento) · 9. canje único con 3 cajas a la vez · 10. estadísticas iguales a la BD · 12. la API rechaza el acceso anónimo y las escrituras directas · además: niveles de recompensas, límites, consentimiento de promociones, vinculación de clientes de mostrador y auditoría.

**Pendiente de verificar en un proyecto Supabase real:** puntos 5 y 6 (contraseñas y recuperación por correo dependen de Supabase Auth + SMTP) y el recorrido completo en el navegador con sesión iniciada.

---

## Integraciones preparadas (no conectadas)

- **Correo / WhatsApp**: al enviar una campaña, la notificación in-app se entrega al momento y, para clientes con correo y consentimiento, se crea una fila `notifications` con `channel='email'` y `status='pending'`. Un worker futuro (Edge Function o cron) debe tomar esa cola y enviarla con Resend o la API de WhatsApp Business. Hoy no se envía nada por esos canales.
- **SMS OTP** para verificar teléfonos de clientes.
