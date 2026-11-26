-- WebYA Loyalty: instalación completa (pegar todo en Supabase → SQL Editor → Run)

-- ===== 20261126000001_schema.sql =====
-- =====================================================================
-- WebYA Loyalty System — Esquema relacional
-- Multiempresa: todo registro de negocio está ligado a business_id.
-- =====================================================================

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.staff_role as enum ('owner', 'manager', 'employee');
create type public.customer_status as enum ('active', 'blocked');
create type public.stamp_reason as enum ('purchase', 'correction', 'redemption', 'bonus', 'promotion');
create type public.redemption_status as enum ('available', 'redeemed', 'void', 'expired');
create type public.promotion_kind as enum ('discount', 'special_reward', 'temporary', 'frequent', 'winback');
create type public.audience_segment as enum ('all', 'frequent', 'inactive', 'new', 'near_reward', 'pending_reward');
create type public.notification_channel as enum ('in_app', 'email', 'whatsapp');
create type public.notification_status as enum ('pending', 'sent', 'read', 'failed', 'skipped');

-- ---------------------------------------------------------------------
-- Negocios
-- ---------------------------------------------------------------------
create table public.businesses (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  name            text not null check (char_length(name) between 2 and 120),
  tagline         text check (char_length(tagline) <= 160),
  logo_url        text,
  primary_color   text not null default '#6F4E37' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color    text not null default '#C8A27C' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  contact_email   text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone   text,
  whatsapp        text,
  address         text,
  city            text,
  country_code    char(2) not null default 'MX',
  timezone        text not null default 'America/Mexico_City',
  currency        char(3) not null default 'MXN',
  custom_domain   text unique check (custom_domain is null or custom_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  inactive_after_days integer not null default 30 check (inactive_after_days between 7 and 365),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text check (char_length(full_name) <= 120),
  email             text,
  phone             text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  kind              text not null default 'staff' check (kind in ('staff', 'customer')),
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index profiles_phone_customer_uniq on public.profiles(phone) where kind = 'customer';

-- ---------------------------------------------------------------------
-- Membresías (autorización del personal) y empleados (ficha)
-- ---------------------------------------------------------------------
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.staff_role not null,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id) where is_active;

create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  membership_id uuid not null unique references public.memberships(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 2 and 120),
  position      text check (char_length(position) <= 80),
  phone         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index employees_business_idx on public.employees(business_id);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  user_id             uuid references public.profiles(id) on delete set null,
  first_name          text not null check (char_length(first_name) between 1 and 60),
  last_name           text not null check (char_length(last_name) between 1 and 60),
  phone               text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email               text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  marketing_opt_in    boolean not null default false,
  marketing_opt_in_at timestamptz,
  qr_token            text not null unique default encode(gen_random_bytes(12), 'hex'),
  status              public.customer_status not null default 'active',
  notes               text check (char_length(notes) <= 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (business_id, phone),
  unique (business_id, user_id)
);
create index customers_business_created_idx on public.customers(business_id, created_at desc);
create index customers_user_idx on public.customers(user_id);
create index customers_search_idx on public.customers
  using gin (to_tsvector('simple', first_name || ' ' || last_name || ' ' || phone || ' ' || coalesce(email, '')));

-- ---------------------------------------------------------------------
-- Programa de fidelización y tarjetas
-- ---------------------------------------------------------------------
create table public.loyalty_programs (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  name                  text not null default 'Tarjeta de fidelidad',
  stamps_required       integer not null default 10 check (stamps_required between 3 and 50),
  reward_description    text not null default 'Café gratis',
  max_stamps_per_visit  integer not null default 1 check (max_stamps_per_visit between 1 and 20),
  cooldown_minutes      integer not null default 5 check (cooldown_minutes between 0 and 1440),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index loyalty_programs_one_active on public.loyalty_programs(business_id) where is_active;

create table public.loyalty_cards (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  program_id      uuid not null references public.loyalty_programs(id) on delete restrict,
  stamp_balance   integer not null default 0 check (stamp_balance >= 0),
  lifetime_stamps integer not null default 0 check (lifetime_stamps >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (customer_id, program_id)
);
create index loyalty_cards_business_idx on public.loyalty_cards(business_id);

-- ---------------------------------------------------------------------
-- Visitas / compras
-- ---------------------------------------------------------------------
create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  card_id         uuid not null references public.loyalty_cards(id) on delete cascade,
  recorded_by     uuid references public.profiles(id),
  amount          numeric(12,2) check (amount is null or amount >= 0),
  stamps_awarded  integer not null check (stamps_awarded between 0 and 50),
  idempotency_key uuid not null,
  note            text check (char_length(note) <= 280),
  created_at      timestamptz not null default now(),
  unique (business_id, idempotency_key)
);
create index visits_business_created_idx on public.visits(business_id, created_at desc);
create index visits_customer_created_idx on public.visits(customer_id, created_at desc);

-- ---------------------------------------------------------------------
-- Libro mayor de sellos (inmutable, trazable)
-- ---------------------------------------------------------------------
create table public.stamps (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  card_id       uuid not null references public.loyalty_cards(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  visit_id      uuid references public.visits(id) on delete set null,
  redemption_id uuid,
  delta         integer not null check (delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason        public.stamp_reason not null,
  note          text check (char_length(note) <= 280),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index stamps_business_created_idx on public.stamps(business_id, created_at desc);
create index stamps_card_idx on public.stamps(card_id, created_at desc);

-- ---------------------------------------------------------------------
-- Recompensas y canjes
-- ---------------------------------------------------------------------
create table public.rewards (
  id                            uuid primary key default gen_random_uuid(),
  business_id                   uuid not null references public.businesses(id) on delete cascade,
  name                          text not null check (char_length(name) between 2 and 80),
  description                   text check (char_length(description) <= 280),
  image_url                     text,
  stamps_required               integer not null check (stamps_required between 1 and 500),
  is_active                     boolean not null default true,
  valid_from                    timestamptz,
  valid_until                   timestamptz,
  max_redemptions_per_customer  integer check (max_redemptions_per_customer is null or max_redemptions_per_customer > 0),
  max_total_redemptions         integer check (max_total_redemptions is null or max_total_redemptions > 0),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);
create index rewards_business_idx on public.rewards(business_id) where is_active;

-- Cada fila es una recompensa concreta emitida a un cliente.
-- available -> redeemed (una sola vez), o -> void / expired.
create table public.reward_redemptions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  reward_id     uuid not null references public.rewards(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  card_id       uuid not null references public.loyalty_cards(id) on delete cascade,
  status        public.redemption_status not null default 'available',
  code          text not null unique default upper(encode(gen_random_bytes(4), 'hex')),
  stamps_cost   integer not null check (stamps_cost > 0),
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz,
  redeemed_at   timestamptz,
  redeemed_by   uuid references public.profiles(id),
  voided_at     timestamptz,
  void_reason   text,
  check ((status = 'redeemed') = (redeemed_at is not null))
);
-- Como máximo una recompensa disponible por (cliente, recompensa).
create unique index reward_redemptions_one_available
  on public.reward_redemptions(customer_id, reward_id) where status = 'available';
create index reward_redemptions_business_idx on public.reward_redemptions(business_id, status, redeemed_at desc);

-- Recompensa base del programa (ej. 10 sellos = café gratis).
alter table public.loyalty_programs
  add column base_reward_id uuid references public.rewards(id) on delete set null;

alter table public.stamps
  add constraint stamps_redemption_fk foreign key (redemption_id)
  references public.reward_redemptions(id) on delete set null;

-- ---------------------------------------------------------------------
-- Promociones
-- ---------------------------------------------------------------------
create table public.promotions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  title            text not null check (char_length(title) between 3 and 100),
  description      text check (char_length(description) <= 500),
  kind             public.promotion_kind not null,
  segment          public.audience_segment not null default 'all',
  discount_percent integer check (discount_percent is null or discount_percent between 1 and 100),
  bonus_stamps     integer check (bonus_stamps is null or bonus_stamps between 1 and 20),
  starts_at        timestamptz not null default now(),
  ends_at          timestamptz,
  is_active        boolean not null default true,
  last_sent_at     timestamptz,
  recipients_count integer not null default 0,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index promotions_business_idx on public.promotions(business_id, is_active, starts_at desc);

-- ---------------------------------------------------------------------
-- Notificaciones (in-app hoy; email/WhatsApp quedan en cola 'pending')
-- ---------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  customer_id   uuid references public.customers(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  promotion_id  uuid references public.promotions(id) on delete set null,
  channel       public.notification_channel not null default 'in_app',
  status        public.notification_status not null default 'sent',
  kind          text not null,
  title         text not null,
  body          text,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (customer_id is not null or user_id is not null)
);
create index notifications_customer_idx on public.notifications(customer_id, created_at desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_outbox_idx on public.notifications(channel, status) where status = 'pending';

-- ---------------------------------------------------------------------
-- Auditoría (solo inserción desde funciones del servidor)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs(business_id, created_at desc);

-- ---------------------------------------------------------------------
-- Límite de intentos (login/registro) — usado solo por el servidor
-- ---------------------------------------------------------------------
create table private.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['businesses','profiles','memberships','employees','customers',
                           'loyalty_programs','loyalty_cards','rewards','promotions']
  loop
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function private.touch_updated_at()', t, t);
  end loop;
end $$;

-- ===== 20261126000002_functions.sql =====
-- =====================================================================
-- WebYA Loyalty System — Lógica de negocio en el servidor
--
-- Toda escritura sensible pasa por funciones SECURITY DEFINER que:
--   1. identifican al usuario con auth.uid() (nunca con un parámetro),
--   2. verifican su rol dentro del negocio,
--   3. validan los datos,
--   4. ejecutan la operación en una transacción con bloqueos de fila,
--   5. dejan registro en audit_logs.
-- Los clientes y el personal NO tienen permisos INSERT/UPDATE/DELETE
-- directos sobre las tablas (ver migración de RLS).
--
-- Errores: se lanzan con mensajes en MAYÚSCULAS que la app traduce.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de autorización (esquema privado, no expuesto por la API)
-- ---------------------------------------------------------------------
create or replace function private.staff_role_in(p_business uuid)
returns public.staff_role
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.role
  from public.memberships m
  join public.businesses b on b.id = m.business_id
  where m.business_id = p_business
    and m.user_id = auth.uid()
    and m.is_active
    and b.is_active
$$;

create or replace function private.has_role(p_business uuid, p_roles public.staff_role[])
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(private.staff_role_in(p_business) = any(p_roles), false)
$$;

create or replace function private.is_member(p_business uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select private.staff_role_in(p_business) is not null
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function private.is_customer_of(p_business uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.customers c
    where c.business_id = p_business and c.user_id = auth.uid() and c.status = 'active'
  )
$$;

create or replace function private.my_customer_ids()
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id from public.customers c where c.user_id = auth.uid()
$$;

create or replace function private.is_coworker(p_profile uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.business_id = mine.business_id
    where mine.user_id = auth.uid() and mine.is_active and theirs.user_id = p_profile
  )
$$;

create or replace function private.require_role(p_business uuid, p_roles public.staff_role[])
returns public.staff_role
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_role public.staff_role;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  v_role := private.staff_role_in(p_business);
  if v_role is null or not (v_role = any(p_roles)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_role;
end $$;

create or replace function private.audit(
  p_business uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public, pg_temp
as $$
  insert into public.audit_logs(business_id, actor_id, action, entity, entity_id, details)
  values (p_business, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function private.clean_text(p text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), '')
$$;

create or replace function private.active_program(p_business uuid)
returns public.loyalty_programs
language sql stable security definer set search_path = public, pg_temp
as $$
  select * from public.loyalty_programs where business_id = p_business and is_active limit 1
$$;

-- Obtiene (o crea) la tarjeta del cliente en el programa activo y la bloquea.
create or replace function private.lock_card(p_business uuid, p_customer uuid)
returns public.loyalty_cards
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_program public.loyalty_programs;
  v_card public.loyalty_cards;
begin
  v_program := private.active_program(p_business);
  if v_program.id is null then
    raise exception 'NO_ACTIVE_PROGRAM';
  end if;
  insert into public.loyalty_cards(business_id, customer_id, program_id)
  values (p_business, p_customer, v_program.id)
  on conflict (customer_id, program_id) do nothing;

  select * into v_card from public.loyalty_cards
  where customer_id = p_customer and program_id = v_program.id
  for update;
  return v_card;
end $$;

-- ---------------------------------------------------------------------
-- Motor de recompensas: emite / anula recompensas según el saldo.
-- Debe llamarse con la tarjeta ya bloqueada (FOR UPDATE).
-- Devuelve cuántas recompensas nuevas se emitieron.
-- ---------------------------------------------------------------------
create or replace function private.sync_card_rewards(p_card uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_card public.loyalty_cards;
  v_reward public.rewards;
  v_issued integer := 0;
  v_redemption uuid;
begin
  select * into v_card from public.loyalty_cards where id = p_card;
  if v_card.id is null then return 0; end if;

  -- Caducadas
  update public.reward_redemptions
     set status = 'expired', voided_at = now(), void_reason = 'expired'
   where card_id = p_card and status = 'available'
     and expires_at is not null and expires_at <= now();

  -- Ya no alcanzables, recompensa desactivada, fuera de vigencia o con costo cambiado
  update public.reward_redemptions rr
     set status = 'void', voided_at = now(),
         void_reason = case
           when not r.is_active then 'reward_inactive'
           when r.valid_until is not null and r.valid_until <= now() then 'reward_ended'
           when rr.stamps_cost <> r.stamps_required then 'cost_changed'
           else 'insufficient_stamps' end
    from public.rewards r
   where rr.reward_id = r.id
     and rr.card_id = p_card
     and rr.status = 'available'
     and (not r.is_active
          or (r.valid_until is not null and r.valid_until <= now())
          or rr.stamps_cost <> r.stamps_required
          or rr.stamps_cost > v_card.stamp_balance);

  -- Emitir las que ya se alcanzan
  for v_reward in
    select r.* from public.rewards r
    where r.business_id = v_card.business_id
      and r.is_active
      and r.stamps_required <= v_card.stamp_balance
      and (r.valid_from is null or r.valid_from <= now())
      and (r.valid_until is null or r.valid_until > now())
      and not exists (select 1 from public.reward_redemptions x
                      where x.customer_id = v_card.customer_id and x.reward_id = r.id and x.status = 'available')
      and (r.max_redemptions_per_customer is null or
           (select count(*) from public.reward_redemptions x
             where x.customer_id = v_card.customer_id and x.reward_id = r.id and x.status = 'redeemed')
           < r.max_redemptions_per_customer)
      and (r.max_total_redemptions is null or
           (select count(*) from public.reward_redemptions x
             where x.reward_id = r.id and x.status = 'redeemed') < r.max_total_redemptions)
    order by r.stamps_required
  loop
    insert into public.reward_redemptions(business_id, reward_id, customer_id, card_id, stamps_cost, expires_at)
    values (v_card.business_id, v_reward.id, v_card.customer_id, v_card.id, v_reward.stamps_required, v_reward.valid_until)
    returning id into v_redemption;

    insert into public.notifications(business_id, customer_id, kind, title, body)
    values (v_card.business_id, v_card.customer_id, 'reward_available',
            '¡Recompensa desbloqueada!',
            format('Ya puedes canjear: %s. Muéstrale tu tarjeta al personal.', v_reward.name));
    v_issued := v_issued + 1;
  end loop;

  return v_issued;
end $$;

create or replace function private.sync_business_rewards(p_business uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_card uuid;
begin
  for v_card in
    select id from public.loyalty_cards where business_id = p_business order by id for update
  loop
    perform private.sync_card_rewards(v_card);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Alta de perfiles: se crean al crear un usuario en auth.users.
-- 'kind' y 'phone' se leen de raw_app_meta_data, que SOLO el servidor
-- (service_role) puede escribir; el usuario no puede falsificarlos.
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_kind text := coalesce(new.raw_app_meta_data ->> 'kind', 'staff');
begin
  insert into public.profiles(id, full_name, email, phone, kind)
  values (
    new.id,
    private.clean_text(coalesce(new.raw_app_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'full_name')),
    case when v_kind = 'staff' then new.email else null end,
    case when v_kind = 'customer' then new.raw_app_meta_data ->> 'phone' else null end,
    case when v_kind in ('staff', 'customer') then v_kind else 'staff' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- =====================================================================
-- API pública (RPC)
-- =====================================================================

-- Información pública y segura de un negocio (página de registro por QR).
create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', b.id, 'slug', b.slug, 'name', b.name, 'tagline', b.tagline,
    'logo_url', b.logo_url, 'primary_color', b.primary_color, 'accent_color', b.accent_color,
    'address', b.address, 'city', b.city, 'contact_phone', b.contact_phone,
    'country_code', b.country_code,
    'program', (select jsonb_build_object('name', p.name, 'stamps_required', p.stamps_required,
                                          'reward_description', p.reward_description)
                from public.loyalty_programs p where p.business_id = b.id and p.is_active),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('name', r.name, 'description', r.description,
                                   'stamps_required', r.stamps_required, 'image_url', r.image_url)
                                   order by r.stamps_required)
                         from public.rewards r
                         where r.business_id = b.id and r.is_active
                           and (r.valid_until is null or r.valid_until > now())), '[]'::jsonb)
  )
  from public.businesses b
  where b.slug = lower(p_slug) and b.is_active
$$;

create or replace function public.resolve_business_domain(p_host text)
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select slug from public.businesses where custom_domain = lower(p_host) and is_active
$$;

-- Rol del usuario actual en un negocio (null si no es personal).
create or replace function public.my_staff_role(p_business uuid)
returns public.staff_role
language sql stable security definer set search_path = public, pg_temp
as $$ select private.staff_role_in(p_business) $$;

-- ---------------------------------------------------------------------
-- CLIENTE: unirse a un negocio (registro por QR)
-- ---------------------------------------------------------------------
create or replace function public.join_business(
  p_slug text, p_first_name text, p_last_name text,
  p_email text default null, p_marketing_opt_in boolean default false)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_business public.businesses;
  v_customer public.customers;
  v_first text := private.clean_text(p_first_name);
  v_last text := private.clean_text(p_last_name);
  v_email text := lower(private.clean_text(p_email));
  v_card public.loyalty_cards;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.kind is distinct from 'customer' or v_profile.phone is null then
    raise exception 'NOT_A_CUSTOMER_ACCOUNT' using errcode = '42501';
  end if;

  select * into v_business from public.businesses where slug = lower(p_slug) and is_active;
  if v_business.id is null then raise exception 'BUSINESS_NOT_FOUND'; end if;

  if v_first is null or v_last is null or char_length(v_first) > 60 or char_length(v_last) > 60 then
    raise exception 'INVALID_NAME';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  select * into v_customer from public.customers
  where business_id = v_business.id and phone = v_profile.phone
  for update;

  if v_customer.id is not null then
    if v_customer.user_id = v_uid then
      return v_customer.id;
    elsif v_customer.user_id is not null then
      raise exception 'PHONE_ALREADY_REGISTERED';
    end if;
    -- El personal lo había registrado en mostrador: se vincula la cuenta.
    update public.customers
       set user_id = v_uid,
           email = coalesce(v_email, email),
           marketing_opt_in = coalesce(p_marketing_opt_in, false),
           marketing_opt_in_at = case when p_marketing_opt_in then now() else null end
     where id = v_customer.id
     returning * into v_customer;
  else
    insert into public.customers(business_id, user_id, first_name, last_name, phone, email,
                                 marketing_opt_in, marketing_opt_in_at)
    values (v_business.id, v_uid, v_first, v_last, v_profile.phone, v_email,
            coalesce(p_marketing_opt_in, false), case when p_marketing_opt_in then now() end)
    returning * into v_customer;

    insert into public.notifications(business_id, customer_id, kind, title, body)
    values (v_business.id, v_customer.id, 'welcome', format('Bienvenido a %s', v_business.name),
            'Tu tarjeta digital ya está activa. Muestra tu código en cada compra para sumar sellos.');
  end if;

  v_card := private.lock_card(v_business.id, v_customer.id);
  perform private.sync_card_rewards(v_card.id);
  perform private.audit(v_business.id, 'customer.self_registered', 'customer', v_customer.id,
                        jsonb_build_object('claimed', v_customer.created_at < now() - interval '1 second'));
  return v_customer.id;
end $$;

create or replace function public.set_marketing_consent(p_business uuid, p_opt_in boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  update public.customers
     set marketing_opt_in = p_opt_in,
         marketing_opt_in_at = case when p_opt_in then now() else null end
   where business_id = p_business and user_id = auth.uid()
   returning id into v_id;
  if v_id is null then raise exception 'NOT_FOUND'; end if;
  perform private.audit(p_business, case when p_opt_in then 'customer.opt_in' else 'customer.opt_out' end,
                        'customer', v_id, '{}'::jsonb);
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  update public.notifications n
     set read_at = now(), status = case when n.status = 'sent' then 'read' else n.status end
   where n.read_at is null
     and n.channel = 'in_app'
     and (p_ids is null or n.id = any(p_ids))
     and (n.user_id = auth.uid() or n.customer_id in (select private.my_customer_ids()));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- PERSONAL: alta de cliente en mostrador
-- ---------------------------------------------------------------------
create or replace function public.staff_create_customer(
  p_business uuid, p_first_name text, p_last_name text, p_phone text,
  p_email text default null, p_marketing_opt_in boolean default false)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_first text := private.clean_text(p_first_name);
  v_last text := private.clean_text(p_last_name);
  v_email text := lower(private.clean_text(p_email));
  v_id uuid;
  v_card public.loyalty_cards;
begin
  perform private.require_role(p_business, array['owner','manager','employee']::public.staff_role[]);
  if v_first is null or v_last is null then raise exception 'INVALID_NAME'; end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'INVALID_PHONE'; end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL'; end if;

  begin
    insert into public.customers(business_id, first_name, last_name, phone, email, marketing_opt_in, marketing_opt_in_at)
    values (p_business, v_first, v_last, p_phone, v_email, coalesce(p_marketing_opt_in, false),
            case when p_marketing_opt_in then now() end)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'PHONE_ALREADY_REGISTERED';
  end;

  v_card := private.lock_card(p_business, v_id);
  perform private.audit(p_business, 'customer.created_by_staff', 'customer', v_id,
                        jsonb_build_object('phone', p_phone));
  return v_id;
end $$;

create or replace function public.update_customer(
  p_business uuid, p_customer uuid, p_first_name text, p_last_name text,
  p_email text, p_notes text, p_status public.customer_status)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_before public.customers;
  v_email text := lower(private.clean_text(p_email));
begin
  perform private.require_role(p_business, array['owner','manager']::public.staff_role[]);
  select * into v_before from public.customers where id = p_customer and business_id = p_business for update;
  if v_before.id is null then raise exception 'NOT_FOUND'; end if;
  if private.clean_text(p_first_name) is null or private.clean_text(p_last_name) is null then
    raise exception 'INVALID_NAME';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL'; end if;

  update public.customers
     set first_name = private.clean_text(p_first_name),
         last_name = private.clean_text(p_last_name),
         email = v_email,
         notes = private.clean_text(p_notes),
         status = p_status
   where id = p_customer;

  perform private.audit(p_business, 'customer.updated', 'customer', p_customer,
    jsonb_build_object('status_before', v_before.status, 'status_after', p_status));
end $$;

-- ---------------------------------------------------------------------
-- PERSONAL: registrar compra (+ sellos). Idempotente y transaccional.
-- ---------------------------------------------------------------------
create or replace function public.register_purchase(
  p_business uuid, p_customer uuid, p_stamps integer, p_amount numeric,
  p_idempotency_key uuid, p_note text default null, p_override_cooldown boolean default false)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_role public.staff_role;
  v_customer public.customers;
  v_program public.loyalty_programs;
  v_card public.loyalty_cards;
  v_visit public.visits;
  v_visit_id uuid;
  v_new_rewards integer;
  v_max integer;
begin
  v_role := private.require_role(p_business, array['owner','manager','employee']::public.staff_role[]);
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  -- Reintento de la misma operación: devolver el resultado original.
  select * into v_visit from public.visits where business_id = p_business and idempotency_key = p_idempotency_key;
  if v_visit.id is not null then
    select * into v_card from public.loyalty_cards where id = v_visit.card_id;
    return jsonb_build_object('visit_id', v_visit.id, 'duplicate', true,
                              'stamp_balance', v_card.stamp_balance, 'new_rewards', 0);
  end if;

  select * into v_customer from public.customers where id = p_customer and business_id = p_business;
  if v_customer.id is null then raise exception 'NOT_FOUND'; end if;
  if v_customer.status <> 'active' then raise exception 'CUSTOMER_BLOCKED'; end if;

  v_program := private.active_program(p_business);
  if v_program.id is null then raise exception 'NO_ACTIVE_PROGRAM'; end if;

  v_max := case when v_role = 'employee' then v_program.max_stamps_per_visit else 20 end;
  if p_stamps is null or p_stamps < 1 or p_stamps > v_max then
    raise exception 'INVALID_STAMP_COUNT' using detail = format('max=%s', v_max);
  end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 1000000) then raise exception 'INVALID_AMOUNT'; end if;

  -- Bloqueo de la tarjeta: serializa operaciones concurrentes del mismo cliente.
  v_card := private.lock_card(p_business, p_customer);

  -- Protección contra doble registro accidental.
  if v_program.cooldown_minutes > 0
     and not (p_override_cooldown and v_role in ('owner','manager'))
     and exists (select 1 from public.visits
                 where customer_id = p_customer
                   and created_at > now() - make_interval(mins => v_program.cooldown_minutes)) then
    raise exception 'COOLDOWN_ACTIVE' using detail = format('minutes=%s', v_program.cooldown_minutes);
  end if;

  insert into public.visits(business_id, customer_id, card_id, recorded_by, amount, stamps_awarded, idempotency_key, note)
  values (p_business, p_customer, v_card.id, auth.uid(), p_amount, p_stamps, p_idempotency_key, private.clean_text(p_note))
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_visit_id;

  if v_visit_id is null then
    select * into v_card from public.loyalty_cards where id = v_card.id;
    return jsonb_build_object('visit_id', null, 'duplicate', true, 'stamp_balance', v_card.stamp_balance, 'new_rewards', 0);
  end if;

  update public.loyalty_cards
     set stamp_balance = stamp_balance + p_stamps,
         lifetime_stamps = lifetime_stamps + p_stamps
   where id = v_card.id
   returning * into v_card;

  insert into public.stamps(business_id, card_id, customer_id, visit_id, delta, balance_after, reason, created_by)
  values (p_business, v_card.id, p_customer, v_visit_id, p_stamps, v_card.stamp_balance, 'purchase', auth.uid());

  v_new_rewards := private.sync_card_rewards(v_card.id);

  perform private.audit(p_business, 'visit.registered', 'visit', v_visit_id,
    jsonb_build_object('customer_id', p_customer, 'stamps', p_stamps, 'amount', p_amount,
                       'override_cooldown', coalesce(p_override_cooldown, false)));

  return jsonb_build_object('visit_id', v_visit_id, 'duplicate', false,
                            'stamp_balance', v_card.stamp_balance, 'new_rewards', v_new_rewards);
end $$;

-- ---------------------------------------------------------------------
-- Corrección autorizada de sellos (propietario o gerente)
-- ---------------------------------------------------------------------
create or replace function public.adjust_stamps(
  p_business uuid, p_customer uuid, p_delta integer, p_note text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_card public.loyalty_cards;
  v_note text := private.clean_text(p_note);
  v_exists boolean;
begin
  perform private.require_role(p_business, array['owner','manager']::public.staff_role[]);
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100 then raise exception 'INVALID_STAMP_COUNT'; end if;
  if v_note is null or char_length(v_note) < 3 then raise exception 'REASON_REQUIRED'; end if;

  select exists(select 1 from public.customers where id = p_customer and business_id = p_business) into v_exists;
  if not v_exists then raise exception 'NOT_FOUND'; end if;

  v_card := private.lock_card(p_business, p_customer);
  if v_card.stamp_balance + p_delta < 0 then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.loyalty_cards
     set stamp_balance = stamp_balance + p_delta,
         lifetime_stamps = greatest(lifetime_stamps + p_delta, 0)
   where id = v_card.id
   returning * into v_card;

  insert into public.stamps(business_id, card_id, customer_id, delta, balance_after, reason, note, created_by)
  values (p_business, v_card.id, p_customer, p_delta, v_card.stamp_balance, 'correction', v_note, auth.uid());

  perform private.sync_card_rewards(v_card.id);
  perform private.audit(p_business, 'stamps.corrected', 'loyalty_card', v_card.id,
    jsonb_build_object('customer_id', p_customer, 'delta', p_delta, 'reason', v_note,
                       'balance_after', v_card.stamp_balance));
  return jsonb_build_object('stamp_balance', v_card.stamp_balance);
end $$;

-- ---------------------------------------------------------------------
-- Canje de recompensa: una sola vez, confirmado por el personal.
-- ---------------------------------------------------------------------
create or replace function public.redeem_reward(p_business uuid, p_redemption uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_card_id uuid;
  v_card public.loyalty_cards;
  v_red public.reward_redemptions;
  v_reward public.rewards;
begin
  perform private.require_role(p_business, array['owner','manager','employee']::public.staff_role[]);

  select card_id into v_card_id from public.reward_redemptions
  where id = p_redemption and business_id = p_business;
  if v_card_id is null then raise exception 'NOT_FOUND'; end if;

  -- Orden de bloqueo fijo: tarjeta -> recompensa (evita interbloqueos).
  select * into v_card from public.loyalty_cards where id = v_card_id for update;
  select * into v_red from public.reward_redemptions where id = p_redemption for update;

  if v_red.status = 'redeemed' then raise exception 'ALREADY_REDEEMED'; end if;
  if v_red.status <> 'available' then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  if v_red.expires_at is not null and v_red.expires_at <= now() then
    perform private.sync_card_rewards(v_card.id);
    raise exception 'REWARD_EXPIRED';
  end if;
  if exists (select 1 from public.customers where id = v_red.customer_id and status <> 'active') then
    raise exception 'CUSTOMER_BLOCKED';
  end if;
  if v_card.stamp_balance < v_red.stamps_cost then raise exception 'INSUFFICIENT_BALANCE'; end if;

  select * into v_reward from public.rewards where id = v_red.reward_id;

  update public.reward_redemptions
     set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid()
   where id = v_red.id;

  update public.loyalty_cards set stamp_balance = stamp_balance - v_red.stamps_cost
   where id = v_card.id returning * into v_card;

  insert into public.stamps(business_id, card_id, customer_id, redemption_id, delta, balance_after, reason, note, created_by)
  values (p_business, v_card.id, v_red.customer_id, v_red.id, -v_red.stamps_cost, v_card.stamp_balance,
          'redemption', v_reward.name, auth.uid());

  insert into public.notifications(business_id, customer_id, kind, title, body)
  values (p_business, v_red.customer_id, 'reward_redeemed', 'Recompensa canjeada',
          format('Disfrutaste: %s. ¡Gracias por tu visita!', v_reward.name));

  perform private.sync_card_rewards(v_card.id);
  perform private.audit(p_business, 'reward.redeemed', 'reward_redemption', v_red.id,
    jsonb_build_object('customer_id', v_red.customer_id, 'reward', v_reward.name, 'cost', v_red.stamps_cost));

  return jsonb_build_object('stamp_balance', v_card.stamp_balance, 'reward', v_reward.name, 'code', v_red.code);
end $$;

-- ---------------------------------------------------------------------
-- Configuración del programa de sellos (propietario)
-- ---------------------------------------------------------------------
create or replace function public.update_loyalty_program(
  p_business uuid, p_name text, p_stamps_required integer, p_reward_description text,
  p_max_stamps_per_visit integer, p_cooldown_minutes integer)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_program public.loyalty_programs;
  v_reward_id uuid;
begin
  perform private.require_role(p_business, array['owner']::public.staff_role[]);
  if p_stamps_required is null or p_stamps_required not between 3 and 50 then raise exception 'INVALID_STAMP_COUNT'; end if;
  if private.clean_text(p_reward_description) is null then raise exception 'INVALID_REWARD'; end if;
  if p_max_stamps_per_visit not between 1 and 20 or p_cooldown_minutes not between 0 and 1440 then
    raise exception 'INVALID_SETTINGS';
  end if;

  v_program := private.active_program(p_business);
  if v_program.id is null then raise exception 'NO_ACTIVE_PROGRAM'; end if;

  v_reward_id := v_program.base_reward_id;
  if v_reward_id is null or not exists (select 1 from public.rewards where id = v_reward_id) then
    insert into public.rewards(business_id, name, stamps_required)
    values (p_business, private.clean_text(p_reward_description), p_stamps_required)
    returning id into v_reward_id;
  else
    update public.rewards
       set name = private.clean_text(p_reward_description), stamps_required = p_stamps_required, is_active = true
     where id = v_reward_id;
  end if;

  update public.loyalty_programs
     set name = coalesce(private.clean_text(p_name), name),
         stamps_required = p_stamps_required,
         reward_description = private.clean_text(p_reward_description),
         max_stamps_per_visit = p_max_stamps_per_visit,
         cooldown_minutes = p_cooldown_minutes,
         base_reward_id = v_reward_id
   where id = v_program.id;

  perform private.sync_business_rewards(p_business);
  perform private.audit(p_business, 'program.updated', 'loyalty_program', v_program.id,
    jsonb_build_object('stamps_required_before', v_program.stamps_required, 'stamps_required', p_stamps_required,
                       'reward', p_reward_description, 'max_stamps_per_visit', p_max_stamps_per_visit,
                       'cooldown_minutes', p_cooldown_minutes));
end $$;

-- ---------------------------------------------------------------------
-- Recompensas (propietario)
-- ---------------------------------------------------------------------
create or replace function public.save_reward(
  p_business uuid, p_id uuid, p_name text, p_description text, p_image_url text,
  p_stamps_required integer, p_is_active boolean, p_valid_from timestamptz, p_valid_until timestamptz,
  p_max_per_customer integer, p_max_total integer)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform private.require_role(p_business, array['owner']::public.staff_role[]);
  if private.clean_text(p_name) is null then raise exception 'INVALID_NAME'; end if;
  if p_stamps_required is null or p_stamps_required not between 1 and 500 then raise exception 'INVALID_STAMP_COUNT'; end if;
  if p_valid_from is not null and p_valid_until is not null and p_valid_until <= p_valid_from then
    raise exception 'INVALID_DATES';
  end if;
  if p_image_url is not null and p_image_url !~ '^https://' then raise exception 'INVALID_IMAGE_URL'; end if;

  if p_id is null then
    insert into public.rewards(business_id, name, description, image_url, stamps_required, is_active,
                               valid_from, valid_until, max_redemptions_per_customer, max_total_redemptions)
    values (p_business, private.clean_text(p_name), private.clean_text(p_description), p_image_url,
            p_stamps_required, coalesce(p_is_active, true), p_valid_from, p_valid_until,
            p_max_per_customer, p_max_total)
    returning id into v_id;
    perform private.audit(p_business, 'reward.created', 'reward', v_id,
      jsonb_build_object('name', p_name, 'stamps_required', p_stamps_required));
  else
    update public.rewards
       set name = private.clean_text(p_name), description = private.clean_text(p_description),
           image_url = p_image_url, stamps_required = p_stamps_required,
           is_active = coalesce(p_is_active, true), valid_from = p_valid_from, valid_until = p_valid_until,
           max_redemptions_per_customer = p_max_per_customer, max_total_redemptions = p_max_total
     where id = p_id and business_id = p_business
     returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
    -- Mantener coherente el programa si es la recompensa base.
    update public.loyalty_programs
       set stamps_required = least(greatest(p_stamps_required, 3), 50),
           reward_description = private.clean_text(p_name)
     where base_reward_id = v_id and p_stamps_required between 3 and 50;
    perform private.audit(p_business, 'reward.updated', 'reward', v_id,
      jsonb_build_object('name', p_name, 'stamps_required', p_stamps_required, 'is_active', p_is_active));
  end if;

  perform private.sync_business_rewards(p_business);
  return v_id;
end $$;

create or replace function public.delete_reward(p_business uuid, p_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_has_history boolean;
begin
  perform private.require_role(p_business, array['owner']::public.staff_role[]);
  if not exists (select 1 from public.rewards where id = p_id and business_id = p_business) then
    raise exception 'NOT_FOUND';
  end if;
  if exists (select 1 from public.loyalty_programs where base_reward_id = p_id) then
    raise exception 'BASE_REWARD_CANNOT_BE_DELETED';
  end if;
  select exists (select 1 from public.reward_redemptions where reward_id = p_id and status = 'redeemed')
    into v_has_history;

  if v_has_history then
    -- Conserva la trazabilidad de canjes: solo se desactiva.
    update public.rewards set is_active = false where id = p_id;
    perform private.sync_business_rewards(p_business);
    perform private.audit(p_business, 'reward.deactivated', 'reward', p_id, '{}'::jsonb);
    return 'deactivated';
  end if;

  delete from public.rewards where id = p_id;
  perform private.audit(p_business, 'reward.deleted', 'reward', p_id, '{}'::jsonb);
  return 'deleted';
end $$;

-- ---------------------------------------------------------------------
-- Configuración del negocio (propietario)
-- ---------------------------------------------------------------------
create or replace function public.update_business_settings(
  p_business uuid, p_name text, p_tagline text, p_logo_url text,
  p_primary_color text, p_accent_color text, p_contact_email text, p_contact_phone text,
  p_whatsapp text, p_address text, p_city text, p_timezone text, p_currency text,
  p_inactive_after_days integer)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform private.require_role(p_business, array['owner']::public.staff_role[]);
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'INVALID_TIMEZONE';
  end if;
  if p_logo_url is not null and p_logo_url !~ '^https://' then raise exception 'INVALID_IMAGE_URL'; end if;

  update public.businesses
     set name = private.clean_text(p_name), tagline = private.clean_text(p_tagline), logo_url = p_logo_url,
         primary_color = p_primary_color, accent_color = p_accent_color,
         contact_email = lower(private.clean_text(p_contact_email)), contact_phone = private.clean_text(p_contact_phone),
         whatsapp = private.clean_text(p_whatsapp), address = private.clean_text(p_address),
         city = private.clean_text(p_city), timezone = p_timezone, currency = upper(p_currency),
         inactive_after_days = p_inactive_after_days
   where id = p_business;

  perform private.audit(p_business, 'business.updated', 'business', p_business,
    jsonb_build_object('name', p_name));
end $$;

-- ---------------------------------------------------------------------
-- Equipo (propietario). La cuenta de auth la crea el servidor con la
-- service_role; aquí solo se otorga/modifica el acceso al negocio.
-- ---------------------------------------------------------------------
create or replace function public.add_staff_member(
  p_business uuid, p_user_id uuid, p_role public.staff_role,
  p_display_name text, p_position text default null, p_phone text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_membership uuid;
begin
  perform private.require_role(p_business, array['owner']::public.staff_role[]);
  if p_role not in ('manager', 'employee') then raise exception 'ROLE_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_MODIFY_SELF'; end if;
  if private.clean_text(p_display_name) is null then raise exception 'INVALID_NAME'; end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then raise exception 'NOT_FOUND'; end if;
  if v_profile.kind <> 'staff' then raise exception 'NOT_A_STAFF_ACCOUNT'; end if;

  if exists (select 1 from public.memberships where business_id = p_business and user_id = p_user_id and role = 'owner') then
    raise exception 'CANNOT_MODIFY_OWNER' using errcode = '42501';
  end if;

  insert into public.memberships(business_id, user_id, role, created_by)
  values (p_business, p_user_id, p_role, auth.uid())
  on conflict (business_id, user_id) do update set role = excluded.role, is_active = true
  returning id into v_membership;

  insert into public.employees(business_id, membership_id, display_name, position, phone)
  values (p_business, v_membership, private.clean_text(p_display_name), private.clean_text(p_position), private.clean_text(p_phone))
  on conflict (membership_id) do update
    set display_name = excluded.display_name, position = excluded.position, phone = excluded.phone;

  update public.profiles set full_name = coalesce(full_name, private.clean_text(p_display_name)) where id = p_user_id;

  perform private.audit(p_business, 'staff.added', 'membership', v_membership,
    jsonb_build_object('user_id', p_user_id, 'role', p_role, 'email', v_profile.email));
  return v_membership;
end $$;

create or replace function public.update_staff_member(
  p_business uuid, p_membership uuid, p_role public.staff_role, p_is_active boolean,
  p_display_name text, p_position text, p_phone text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_m public.memberships;
begin
  perform private.require_role(p_business, array['owner']::public.staff_role[]);
  select * into v_m from public.memberships where id = p_membership and business_id = p_business for update;
  if v_m.id is null then raise exception 'NOT_FOUND'; end if;
  if v_m.user_id = auth.uid() then raise exception 'CANNOT_MODIFY_SELF'; end if;
  if v_m.role = 'owner' then raise exception 'CANNOT_MODIFY_OWNER' using errcode = '42501'; end if;
  if p_role not in ('manager', 'employee') then raise exception 'ROLE_NOT_ALLOWED' using errcode = '42501'; end if;
  if private.clean_text(p_display_name) is null then raise exception 'INVALID_NAME'; end if;

  update public.memberships set role = p_role, is_active = coalesce(p_is_active, true) where id = p_membership;
  insert into public.employees(business_id, membership_id, display_name, position, phone)
  values (p_business, p_membership, private.clean_text(p_display_name), private.clean_text(p_position), private.clean_text(p_phone))
  on conflict (membership_id) do update
    set display_name = excluded.display_name, position = excluded.position, phone = excluded.phone;

  perform private.audit(p_business, 'staff.updated', 'membership', p_membership,
    jsonb_build_object('role_before', v_m.role, 'role', p_role,
                       'active_before', v_m.is_active, 'active', p_is_active));
end $$;

-- ---------------------------------------------------------------------
-- Plataforma WebYA: alta de negocios (solo administradores de plataforma)
-- ---------------------------------------------------------------------
create or replace function public.create_business(
  p_slug text, p_name text, p_owner_user_id uuid, p_owner_name text,
  p_country_code text default 'MX', p_timezone text default 'America/Mexico_City',
  p_currency text default 'MXN', p_custom_domain text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_business uuid;
  v_program uuid;
  v_reward uuid;
  v_membership uuid;
begin
  -- service_role (scripts de servidor) o administrador de plataforma
  if not (private.is_platform_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_owner_user_id and kind = 'staff') then
    raise exception 'NOT_A_STAFF_ACCOUNT';
  end if;

  begin
    insert into public.businesses(slug, name, country_code, timezone, currency, custom_domain)
    values (lower(p_slug), private.clean_text(p_name), upper(p_country_code), p_timezone, upper(p_currency),
            lower(nullif(btrim(p_custom_domain), '')))
    returning id into v_business;
  exception when unique_violation then
    raise exception 'SLUG_TAKEN';
  end;

  insert into public.loyalty_programs(business_id) values (v_business) returning id into v_program;
  insert into public.rewards(business_id, name, description, stamps_required)
  values (v_business, 'Café gratis', 'Un café de la casa por cortesía', 10)
  returning id into v_reward;
  update public.loyalty_programs set base_reward_id = v_reward where id = v_program;

  insert into public.memberships(business_id, user_id, role, created_by)
  values (v_business, p_owner_user_id, 'owner', auth.uid())
  returning id into v_membership;
  insert into public.employees(business_id, membership_id, display_name, position)
  values (v_business, v_membership, coalesce(private.clean_text(p_owner_name), 'Propietario'), 'Propietario');

  perform private.audit(v_business, 'business.created', 'business', v_business,
    jsonb_build_object('slug', p_slug, 'owner', p_owner_user_id));
  return v_business;
end $$;

-- =====================================================================
-- Segmentación y analítica (propietario / gerente)
-- =====================================================================

-- Clientes de un segmento. p_period_days define "reciente"/"inactivo".
create or replace function private.segment_customer_ids(
  p_business uuid, p_segment public.audience_segment, p_period_days integer, p_min_visits integer default 3)
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  with base as (
    select c.id, c.created_at,
           (select max(v.created_at) from public.visits v where v.customer_id = c.id) as last_visit,
           (select count(*) from public.visits v where v.customer_id = c.id
              and v.created_at >= now() - make_interval(days => p_period_days)) as recent_visits,
           coalesce((select lc.stamp_balance from public.loyalty_cards lc
                     join public.loyalty_programs lp on lp.id = lc.program_id and lp.is_active
                     where lc.customer_id = c.id), 0) as balance
    from public.customers c
    where c.business_id = p_business and c.status = 'active'
  )
  select b.id from base b
  where case p_segment
    when 'all' then true
    when 'frequent' then b.recent_visits >= p_min_visits
    when 'inactive' then coalesce(b.last_visit, b.created_at) < now() - make_interval(days => p_period_days)
    when 'new' then b.created_at >= now() - make_interval(days => p_period_days)
    when 'pending_reward' then exists (select 1 from public.reward_redemptions r
                                       where r.customer_id = b.id and r.status = 'available')
    when 'near_reward' then exists (
      select 1 from public.rewards r
      where r.business_id = p_business and r.is_active
        and r.stamps_required > b.balance
        and r.stamps_required - b.balance <= greatest(2, ceil(r.stamps_required * 0.2)::int))
  end
$$;

create or replace function public.get_dashboard_stats(p_business uuid, p_months integer default 6)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_tz text;
  v_inactive integer;
  v_months integer := least(greatest(coalesce(p_months, 6), 1), 24);
  v_month_start timestamptz;
  v_prev_month_start timestamptz;
  v_result jsonb;
begin
  perform private.require_role(p_business, array['owner','manager']::public.staff_role[]);
  select timezone, inactive_after_days into v_tz, v_inactive from public.businesses where id = p_business;
  v_month_start := date_trunc('month', now() at time zone v_tz) at time zone v_tz;
  v_prev_month_start := (date_trunc('month', now() at time zone v_tz) - interval '1 month') at time zone v_tz;

  select jsonb_build_object(
    'timezone', v_tz,
    'inactive_after_days', v_inactive,
    'total_customers', (select count(*) from public.customers where business_id = p_business),
    'new_customers_month', (select count(*) from public.customers where business_id = p_business and created_at >= v_month_start),
    'new_customers_prev_month', (select count(*) from public.customers where business_id = p_business
                                  and created_at >= v_prev_month_start and created_at < v_month_start),
    'total_stamps', coalesce((select sum(delta) from public.stamps where business_id = p_business
                              and reason in ('purchase','bonus','promotion')), 0),
    'available_rewards', (select count(*) from public.reward_redemptions where business_id = p_business and status = 'available'),
    'redeemed_rewards', (select count(*) from public.reward_redemptions where business_id = p_business and status = 'redeemed'),
    'total_visits', (select count(*) from public.visits where business_id = p_business),
    'visits_month', (select count(*) from public.visits where business_id = p_business and created_at >= v_month_start),
    'visits_prev_month', (select count(*) from public.visits where business_id = p_business
                           and created_at >= v_prev_month_start and created_at < v_month_start),
    'revenue_month', coalesce((select sum(amount) from public.visits where business_id = p_business and created_at >= v_month_start), 0),
    'active_customers', (select count(*) from public.customers c where c.business_id = p_business
                          and exists (select 1 from public.visits v where v.customer_id = c.id
                                      and v.created_at >= now() - make_interval(days => v_inactive))),
    'customers_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('period', to_char(m, 'YYYY-MM'), 'value', cnt) order by m), '[]'::jsonb)
      from (select gs as m,
                   (select count(*) from public.customers c where c.business_id = p_business
                     and date_trunc('month', c.created_at at time zone v_tz) = gs) as cnt
            from generate_series(date_trunc('month', now() at time zone v_tz) - make_interval(months => v_months - 1),
                                 date_trunc('month', now() at time zone v_tz), interval '1 month') gs) t),
    'stamps_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('period', to_char(m, 'YYYY-MM'), 'value', total) order by m), '[]'::jsonb)
      from (select gs as m,
                   coalesce((select sum(s.delta) from public.stamps s where s.business_id = p_business
                     and s.reason in ('purchase','bonus','promotion')
                     and date_trunc('month', s.created_at at time zone v_tz) = gs), 0) as total
            from generate_series(date_trunc('month', now() at time zone v_tz) - make_interval(months => v_months - 1),
                                 date_trunc('month', now() at time zone v_tz), interval '1 month') gs) t),
    'redemptions_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('period', to_char(m, 'YYYY-MM'), 'value', cnt) order by m), '[]'::jsonb)
      from (select gs as m,
                   (select count(*) from public.reward_redemptions r where r.business_id = p_business
                     and r.status = 'redeemed' and date_trunc('month', r.redeemed_at at time zone v_tz) = gs) as cnt
            from generate_series(date_trunc('month', now() at time zone v_tz) - make_interval(months => v_months - 1),
                                 date_trunc('month', now() at time zone v_tz), interval '1 month') gs) t),
    'visits_by_week', (
      select coalesce(jsonb_agg(jsonb_build_object('period', to_char(w, 'YYYY-MM-DD'), 'value', cnt) order by w), '[]'::jsonb)
      from (select gs as w,
                   (select count(*) from public.visits v where v.business_id = p_business
                     and date_trunc('week', v.created_at at time zone v_tz) = gs) as cnt
            from generate_series(date_trunc('week', now() at time zone v_tz) - interval '11 weeks',
                                 date_trunc('week', now() at time zone v_tz), interval '1 week') gs) t),
    'activity_by_hour', (
      select jsonb_agg(jsonb_build_object('hour', h, 'value', cnt) order by h)
      from (select h,
                   (select count(*) from public.visits v where v.business_id = p_business
                     and v.created_at >= now() - interval '90 days'
                     and extract(hour from v.created_at at time zone v_tz) = h) as cnt
            from generate_series(0, 23) h) t),
    'top_customers', (
      select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.visits desc, t.name), '[]'::jsonb)
      from (select c.id, c.first_name || ' ' || c.last_name as name, count(v.id) as visits,
                   coalesce(sum(v.amount), 0) as spent
            from public.customers c join public.visits v on v.customer_id = c.id
            where c.business_id = p_business
            group by c.id order by count(v.id) desc, name limit 5) t)
  ) into v_result;

  return v_result;
end $$;

create or replace function public.get_customer_insights(
  p_business uuid, p_period_days integer default null, p_min_visits integer default 3, p_limit integer default 10)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_period integer;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 100);
  v_min integer := greatest(coalesce(p_min_visits, 3), 1);
begin
  perform private.require_role(p_business, array['owner','manager']::public.staff_role[]);
  select coalesce(p_period_days, inactive_after_days) into v_period from public.businesses where id = p_business;
  v_period := least(greatest(v_period, 1), 730);

  return (
    with ov as (
      select c.id, c.first_name || ' ' || c.last_name as name, c.phone, c.created_at,
             (select count(*) from public.visits v where v.customer_id = c.id) as visits,
             (select count(*) from public.visits v where v.customer_id = c.id
                and v.created_at >= now() - make_interval(days => v_period)) as recent_visits,
             (select coalesce(sum(amount), 0) from public.visits v where v.customer_id = c.id) as spent,
             (select max(created_at) from public.visits v where v.customer_id = c.id) as last_visit,
             coalesce((select lc.stamp_balance from public.loyalty_cards lc
                       join public.loyalty_programs lp on lp.id = lc.program_id and lp.is_active
                       where lc.customer_id = c.id), 0) as balance,
             (select count(*) from public.reward_redemptions r where r.customer_id = c.id and r.status = 'available') as pending_rewards
      from public.customers c where c.business_id = p_business and c.status = 'active'
    ),
    seg as (select unnest(array['frequent','inactive','new','near_reward','pending_reward']::public.audience_segment[]) s)
    select jsonb_build_object(
      'period_days', v_period,
      'min_visits', v_min,
      'counts', (select jsonb_object_agg(s::text,
                   (select count(*) from private.segment_customer_ids(p_business, s, v_period, v_min))) from seg),
      'frequent', (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]') from
                    (select * from ov where id in (select private.segment_customer_ids(p_business, 'frequent', v_period, v_min))
                     order by recent_visits desc limit v_limit) x),
      'inactive', (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]') from
                    (select * from ov where id in (select private.segment_customer_ids(p_business, 'inactive', v_period, v_min))
                     order by coalesce(last_visit, created_at) asc limit v_limit) x),
      'new', (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]') from
               (select * from ov where id in (select private.segment_customer_ids(p_business, 'new', v_period, v_min))
                order by created_at desc limit v_limit) x),
      'near_reward', (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]') from
                       (select * from ov where id in (select private.segment_customer_ids(p_business, 'near_reward', v_period, v_min))
                        order by balance desc limit v_limit) x),
      'pending_reward', (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]') from
                          (select * from ov where pending_rewards > 0 order by pending_rewards desc, balance desc limit v_limit) x),
      'top_visits', (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]') from
                      (select * from ov where visits > 0 order by visits desc limit v_limit) x),
      'top_spend', (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]') from
                     (select * from ov where spent > 0 order by spent desc limit v_limit) x)
    )
  );
end $$;

-- ---------------------------------------------------------------------
-- Promociones (propietario / gerente)
-- ---------------------------------------------------------------------
create or replace function public.save_promotion(
  p_business uuid, p_id uuid, p_title text, p_description text, p_kind public.promotion_kind,
  p_segment public.audience_segment, p_discount_percent integer, p_bonus_stamps integer,
  p_starts_at timestamptz, p_ends_at timestamptz, p_is_active boolean)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform private.require_role(p_business, array['owner','manager']::public.staff_role[]);
  if private.clean_text(p_title) is null or char_length(private.clean_text(p_title)) < 3 then raise exception 'INVALID_NAME'; end if;
  if p_ends_at is not null and p_ends_at <= coalesce(p_starts_at, now()) then raise exception 'INVALID_DATES'; end if;
  if p_discount_percent is not null and p_discount_percent not between 1 and 100 then raise exception 'INVALID_DISCOUNT'; end if;
  if p_bonus_stamps is not null and p_bonus_stamps not between 1 and 20 then raise exception 'INVALID_STAMP_COUNT'; end if;

  if p_id is null then
    insert into public.promotions(business_id, title, description, kind, segment, discount_percent, bonus_stamps,
                                  starts_at, ends_at, is_active, created_by)
    values (p_business, private.clean_text(p_title), private.clean_text(p_description), p_kind, p_segment,
            p_discount_percent, p_bonus_stamps, coalesce(p_starts_at, now()), p_ends_at, coalesce(p_is_active, true), auth.uid())
    returning id into v_id;
    perform private.audit(p_business, 'promotion.created', 'promotion', v_id, jsonb_build_object('title', p_title));
  else
    update public.promotions
       set title = private.clean_text(p_title), description = private.clean_text(p_description), kind = p_kind,
           segment = p_segment, discount_percent = p_discount_percent,
           bonus_stamps = case when last_sent_at is null then p_bonus_stamps else bonus_stamps end,
           starts_at = coalesce(p_starts_at, starts_at), ends_at = p_ends_at, is_active = coalesce(p_is_active, true)
     where id = p_id and business_id = p_business
     returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
    perform private.audit(p_business, 'promotion.updated', 'promotion', v_id, jsonb_build_object('title', p_title));
  end if;
  return v_id;
end $$;

-- Envía la campaña: notificación in-app a clientes con consentimiento,
-- deja en cola (pending) el correo para la futura integración, y otorga
-- sellos de regalo una única vez si la promoción los define.
create or replace function public.send_promotion(p_business uuid, p_promotion uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_promo public.promotions;
  v_period integer;
  v_customer public.customers;
  v_card public.loyalty_cards;
  v_notified integer := 0;
  v_queued integer := 0;
  v_bonus integer := 0;
begin
  perform private.require_role(p_business, array['owner','manager']::public.staff_role[]);
  select * into v_promo from public.promotions where id = p_promotion and business_id = p_business for update;
  if v_promo.id is null then raise exception 'NOT_FOUND'; end if;
  if not v_promo.is_active or (v_promo.ends_at is not null and v_promo.ends_at <= now()) then
    raise exception 'PROMOTION_INACTIVE';
  end if;
  if v_promo.last_sent_at is not null then raise exception 'ALREADY_SENT'; end if;
  select inactive_after_days into v_period from public.businesses where id = p_business;

  for v_customer in
    select c.* from public.customers c
    where c.id in (select private.segment_customer_ids(p_business, v_promo.segment, v_period, 3))
    order by c.id
  loop
    if v_promo.bonus_stamps is not null then
      v_card := private.lock_card(p_business, v_customer.id);
      update public.loyalty_cards
         set stamp_balance = stamp_balance + v_promo.bonus_stamps,
             lifetime_stamps = lifetime_stamps + v_promo.bonus_stamps
       where id = v_card.id returning * into v_card;
      insert into public.stamps(business_id, card_id, customer_id, delta, balance_after, reason, note, created_by)
      values (p_business, v_card.id, v_customer.id, v_promo.bonus_stamps, v_card.stamp_balance, 'promotion',
              v_promo.title, auth.uid());
      perform private.sync_card_rewards(v_card.id);
      v_bonus := v_bonus + 1;
    end if;

    if v_customer.marketing_opt_in then
      insert into public.notifications(business_id, customer_id, promotion_id, channel, status, kind, title, body)
      values (p_business, v_customer.id, v_promo.id, 'in_app', 'sent', 'promotion', v_promo.title, v_promo.description);
      v_notified := v_notified + 1;
      if v_customer.email is not null then
        insert into public.notifications(business_id, customer_id, promotion_id, channel, status, kind, title, body)
        values (p_business, v_customer.id, v_promo.id, 'email', 'pending', 'promotion', v_promo.title, v_promo.description);
        v_queued := v_queued + 1;
      end if;
    end if;
  end loop;

  update public.promotions set last_sent_at = now(), recipients_count = v_notified where id = v_promo.id;
  perform private.audit(p_business, 'promotion.sent', 'promotion', v_promo.id,
    jsonb_build_object('notified', v_notified, 'email_queued', v_queued, 'bonus_customers', v_bonus));
  return jsonb_build_object('notified', v_notified, 'email_queued', v_queued, 'bonus_customers', v_bonus);
end $$;

-- ---------------------------------------------------------------------
-- Límite de intentos para el servidor (login / registro)
-- ---------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_hits integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  insert into private.rate_limits(key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when private.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                    then 1 else private.rate_limits.hits + 1 end,
        window_start = case when private.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                    then now() else private.rate_limits.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- ---------------------------------------------------------------------
-- Vista de clientes con métricas. security_invoker => aplica la RLS
-- de quien consulta (el personal ve solo su negocio).
-- ---------------------------------------------------------------------
create view public.customer_overview with (security_invoker = true) as
select
  c.id, c.business_id, c.user_id, c.first_name, c.last_name,
  c.first_name || ' ' || c.last_name as full_name,
  c.phone, c.email, c.status, c.marketing_opt_in, c.qr_token, c.created_at,
  coalesce(v.visits_count, 0) as visits_count,
  coalesce(v.total_spent, 0) as total_spent,
  v.last_visit_at,
  coalesce(lc.stamp_balance, 0) as stamp_balance,
  coalesce(lc.lifetime_stamps, 0) as lifetime_stamps,
  coalesce(r.available_rewards, 0) as available_rewards
from public.customers c
left join lateral (
  select count(*) as visits_count, sum(amount) as total_spent, max(created_at) as last_visit_at
  from public.visits where customer_id = c.id
) v on true
left join lateral (
  select lc.stamp_balance, lc.lifetime_stamps from public.loyalty_cards lc
  join public.loyalty_programs lp on lp.id = lc.program_id and lp.is_active
  where lc.customer_id = c.id limit 1
) lc on true
left join lateral (
  select count(*) as available_rewards from public.reward_redemptions
  where customer_id = c.id and status = 'available'
) r on true;

-- ===== 20261126000003_rls.sql =====
-- =====================================================================
-- WebYA Loyalty System — Row Level Security y permisos
--
-- Principios:
--   * RLS activada en TODAS las tablas.
--   * anon: sin acceso a tablas. Solo get_public_business / resolve_business_domain.
--   * authenticated: solo SELECT, filtrado por políticas. Ninguna escritura
--     directa: todas pasan por funciones validadas y auditadas.
--   * Aislamiento multiempresa: cada política exige pertenencia al business_id.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['businesses','profiles','memberships','employees','customers','loyalty_programs',
                           'loyalty_cards','visits','stamps','rewards','reward_redemptions','promotions',
                           'notifications','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated, public', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on table public.customer_overview from anon, authenticated, public;
grant select on table public.customer_overview to authenticated;
grant select on table public.customer_overview to service_role;

-- Las funciones SECURITY DEFINER pertenecen al propietario de las tablas
-- (postgres), por lo que operan sin RLS tras validar el rol explícitamente.

-- ---------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------
create policy businesses_select on public.businesses for select to authenticated
using (private.is_member(id) or private.is_customer_of(id) or private.is_platform_admin());

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_coworker(id) or private.is_platform_admin());

-- ---------------------------------------------------------------------
-- memberships: cada quien ve la suya; propietario y gerente ven el equipo
-- ---------------------------------------------------------------------
create policy memberships_select on public.memberships for select to authenticated
using (user_id = (select auth.uid())
       or private.has_role(business_id, array['owner','manager']::public.staff_role[])
       or private.is_platform_admin());

-- ---------------------------------------------------------------------
-- employees: visible para el personal del negocio (nombres en historial)
-- ---------------------------------------------------------------------
create policy employees_select on public.employees for select to authenticated
using (private.is_member(business_id));

-- ---------------------------------------------------------------------
-- customers: personal del negocio o el propio cliente
-- ---------------------------------------------------------------------
create policy customers_select on public.customers for select to authenticated
using (private.is_member(business_id) or user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- programa y recompensas: personal o clientes del negocio
-- ---------------------------------------------------------------------
create policy loyalty_programs_select on public.loyalty_programs for select to authenticated
using (private.is_member(business_id) or private.is_customer_of(business_id));

create policy rewards_select on public.rewards for select to authenticated
using (private.is_member(business_id) or (private.is_customer_of(business_id) and is_active));

-- ---------------------------------------------------------------------
-- datos por cliente: personal del negocio o el propio cliente
-- ---------------------------------------------------------------------
create policy loyalty_cards_select on public.loyalty_cards for select to authenticated
using (private.is_member(business_id) or customer_id in (select private.my_customer_ids()));

create policy visits_select on public.visits for select to authenticated
using (private.is_member(business_id) or customer_id in (select private.my_customer_ids()));

create policy stamps_select on public.stamps for select to authenticated
using (private.is_member(business_id) or customer_id in (select private.my_customer_ids()));

create policy reward_redemptions_select on public.reward_redemptions for select to authenticated
using (private.is_member(business_id) or customer_id in (select private.my_customer_ids()));

-- ---------------------------------------------------------------------
-- promociones: personal ve todas; clientes solo las vigentes de su negocio
-- ---------------------------------------------------------------------
create policy promotions_select on public.promotions for select to authenticated
using (private.is_member(business_id)
       or (private.is_customer_of(business_id) and is_active and starts_at <= now()
           and (ends_at is null or ends_at > now())));

-- ---------------------------------------------------------------------
-- notificaciones: solo el destinatario (canal in_app para clientes)
-- ---------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
using (user_id = (select auth.uid())
       or (channel = 'in_app' and customer_id in (select private.my_customer_ids()))
       or private.has_role(business_id, array['owner','manager']::public.staff_role[]));

-- ---------------------------------------------------------------------
-- auditoría: solo el propietario del negocio
-- ---------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs for select to authenticated
using (private.has_role(business_id, array['owner']::public.staff_role[]) or private.is_platform_admin());

-- =====================================================================
-- Funciones: nada ejecutable por defecto; se concede explícitamente.
-- =====================================================================
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
revoke usage on schema private from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- Las políticas RLS invocan helpers privados como el usuario que consulta.
grant usage on schema private to authenticated;
grant execute on function
  private.staff_role_in(uuid),
  private.has_role(uuid, public.staff_role[]),
  private.is_member(uuid),
  private.is_platform_admin(),
  private.is_customer_of(uuid),
  private.my_customer_ids(),
  private.is_coworker(uuid)
to authenticated;

-- Públicas (sin sesión)
grant execute on function public.get_public_business(text) to anon, authenticated;
grant execute on function public.resolve_business_domain(text) to anon, authenticated;

-- Usuarios autenticados (cada función valida rol internamente)
grant execute on function
  public.my_staff_role(uuid),
  public.join_business(text, text, text, text, boolean),
  public.set_marketing_consent(uuid, boolean),
  public.mark_notifications_read(uuid[]),
  public.staff_create_customer(uuid, text, text, text, text, boolean),
  public.update_customer(uuid, uuid, text, text, text, text, public.customer_status),
  public.register_purchase(uuid, uuid, integer, numeric, uuid, text, boolean),
  public.adjust_stamps(uuid, uuid, integer, text),
  public.redeem_reward(uuid, uuid),
  public.update_loyalty_program(uuid, text, integer, text, integer, integer),
  public.save_reward(uuid, uuid, text, text, text, integer, boolean, timestamptz, timestamptz, integer, integer),
  public.delete_reward(uuid, uuid),
  public.update_business_settings(uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer),
  public.add_staff_member(uuid, uuid, public.staff_role, text, text, text),
  public.update_staff_member(uuid, uuid, public.staff_role, boolean, text, text, text),
  public.create_business(text, text, uuid, text, text, text, text, text),
  public.get_dashboard_stats(uuid, integer),
  public.get_customer_insights(uuid, integer, integer, integer),
  public.save_promotion(uuid, uuid, text, text, public.promotion_kind, public.audience_segment, integer, integer, timestamptz, timestamptz, boolean),
  public.send_promotion(uuid, uuid)
to authenticated;

grant execute on all functions in schema public to service_role;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;

-- ===== 20261126000004_storage.sql =====
-- Bucket público para logotipos y fotos de recompensas.
-- Las subidas las hace el servidor (service_role) tras validar el rol del
-- usuario; el navegador nunca escribe directamente en Storage.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('business-assets', 'business-assets', true, 2097152,
            array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;
