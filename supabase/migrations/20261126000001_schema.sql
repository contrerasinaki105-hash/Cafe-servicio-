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
