-- =====================================================================
-- QR de sello de un solo uso: el personal genera un código por compra,
-- el cliente lo escanea con su teléfono y el sello se acredita.
-- Caduca en pocos minutos, sirve una sola vez y queda auditado.
-- =====================================================================

create table public.stamp_claims (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  token         text not null unique default encode(gen_random_bytes(18), 'hex'),
  stamps        integer not null check (stamps between 1 and 20),
  amount        numeric(12,2) check (amount is null or amount >= 0),
  status        text not null default 'pending' check (status in ('pending', 'claimed', 'cancelled')),
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  claimed_at    timestamptz,
  customer_id   uuid references public.customers(id) on delete set null,
  visit_id      uuid references public.visits(id) on delete set null
);
create index stamp_claims_business_idx on public.stamp_claims(business_id, created_at desc);

alter table public.stamp_claims enable row level security;
revoke all on table public.stamp_claims from anon, authenticated, public;
grant select on table public.stamp_claims to authenticated;
grant all on table public.stamp_claims to service_role;

create policy stamp_claims_select on public.stamp_claims for select to authenticated
using (private.is_member(business_id));

-- ---------------------------------------------------------------------
-- Personal: generar QR de sello
-- ---------------------------------------------------------------------
create or replace function public.create_stamp_claim(
  p_business uuid, p_stamps integer, p_amount numeric default null, p_ttl_seconds integer default 120)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_role public.staff_role;
  v_program public.loyalty_programs;
  v_max integer;
  v_claim public.stamp_claims;
begin
  v_role := private.require_role(p_business, array['owner','manager','employee']::public.staff_role[]);
  v_program := private.active_program(p_business);
  if v_program.id is null then raise exception 'NO_ACTIVE_PROGRAM'; end if;
  v_max := case when v_role = 'employee' then v_program.max_stamps_per_visit else 20 end;
  if p_stamps is null or p_stamps < 1 or p_stamps > v_max then
    raise exception 'INVALID_STAMP_COUNT' using detail = format('max=%s', v_max);
  end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 1000000) then raise exception 'INVALID_AMOUNT'; end if;

  insert into public.stamp_claims(business_id, stamps, amount, created_by, expires_at)
  values (p_business, p_stamps, p_amount, auth.uid(),
          now() + make_interval(secs => least(greatest(coalesce(p_ttl_seconds, 120), 30), 600)))
  returning * into v_claim;

  perform private.audit(p_business, 'stamp_claim.created', 'stamp_claim', v_claim.id,
    jsonb_build_object('stamps', p_stamps, 'amount', p_amount));
  return jsonb_build_object('id', v_claim.id, 'token', v_claim.token, 'expires_at', v_claim.expires_at,
                            'stamps', v_claim.stamps);
end $$;

create or replace function public.get_stamp_claim_status(p_business uuid, p_claim uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_claim public.stamp_claims; v_name text;
begin
  perform private.require_role(p_business, array['owner','manager','employee']::public.staff_role[]);
  select * into v_claim from public.stamp_claims where id = p_claim and business_id = p_business;
  if v_claim.id is null then raise exception 'NOT_FOUND'; end if;
  select first_name || ' ' || last_name into v_name from public.customers where id = v_claim.customer_id;
  return jsonb_build_object(
    'status', case when v_claim.status = 'pending' and v_claim.expires_at <= now() then 'expired' else v_claim.status end,
    'customer_name', v_name, 'claimed_at', v_claim.claimed_at, 'expires_at', v_claim.expires_at);
end $$;

create or replace function public.cancel_stamp_claim(p_business uuid, p_claim uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform private.require_role(p_business, array['owner','manager','employee']::public.staff_role[]);
  update public.stamp_claims set status = 'cancelled'
   where id = p_claim and business_id = p_business and status = 'pending';
end $$;

-- ---------------------------------------------------------------------
-- Público: a qué negocio pertenece un QR (para la pantalla del cliente).
-- No revela nada si el código ya no es válido.
-- ---------------------------------------------------------------------
create or replace function public.get_stamp_claim_public(p_token text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('slug', b.slug, 'name', b.name, 'stamps', c.stamps,
                            'valid', c.status = 'pending' and c.expires_at > now())
  from public.stamp_claims c join public.businesses b on b.id = c.business_id
  where c.token = p_token and b.is_active
$$;

-- ---------------------------------------------------------------------
-- Cliente: canjear el QR y recibir el sello (transaccional, una sola vez)
-- ---------------------------------------------------------------------
create or replace function public.claim_stamps(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_claim public.stamp_claims;
  v_customer public.customers;
  v_program public.loyalty_programs;
  v_card public.loyalty_cards;
  v_visit uuid;
  v_new integer;
  v_slug text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{36}$' then raise exception 'INVALID_CODE'; end if;

  select * into v_claim from public.stamp_claims where token = p_token for update;
  if v_claim.id is null then raise exception 'INVALID_CODE'; end if;
  select slug into v_slug from public.businesses where id = v_claim.business_id and is_active;
  if v_slug is null then raise exception 'INVALID_CODE'; end if;

  select * into v_customer from public.customers
  where business_id = v_claim.business_id and user_id = auth.uid();

  if v_claim.status = 'claimed' then
    if v_customer.id is not null and v_claim.customer_id = v_customer.id then
      select * into v_card from public.loyalty_cards where id = (select card_id from public.visits where id = v_claim.visit_id);
      return jsonb_build_object('slug', v_slug, 'stamps', v_claim.stamps, 'stamp_balance', coalesce(v_card.stamp_balance, 0),
                                'new_rewards', 0, 'duplicate', true);
    end if;
    raise exception 'CODE_ALREADY_USED';
  end if;
  if v_claim.status <> 'pending' then raise exception 'CODE_CANCELLED'; end if;
  if v_claim.expires_at <= now() then raise exception 'CODE_EXPIRED'; end if;

  if v_customer.id is null then raise exception 'NOT_REGISTERED' using detail = v_slug; end if;
  if v_customer.status <> 'active' then raise exception 'CUSTOMER_BLOCKED'; end if;

  v_program := private.active_program(v_claim.business_id);
  if v_program.id is null then raise exception 'NO_ACTIVE_PROGRAM'; end if;

  v_card := private.lock_card(v_claim.business_id, v_customer.id);

  if v_program.cooldown_minutes > 0 and exists (
       select 1 from public.visits where customer_id = v_customer.id
       and created_at > now() - make_interval(mins => v_program.cooldown_minutes)) then
    raise exception 'COOLDOWN_ACTIVE' using detail = format('minutes=%s', v_program.cooldown_minutes);
  end if;

  insert into public.visits(business_id, customer_id, card_id, recorded_by, amount, stamps_awarded, idempotency_key, note)
  values (v_claim.business_id, v_customer.id, v_card.id, v_claim.created_by, v_claim.amount, v_claim.stamps,
          v_claim.id, 'QR de sello')
  returning id into v_visit;

  update public.loyalty_cards
     set stamp_balance = stamp_balance + v_claim.stamps, lifetime_stamps = lifetime_stamps + v_claim.stamps
   where id = v_card.id returning * into v_card;

  insert into public.stamps(business_id, card_id, customer_id, visit_id, delta, balance_after, reason, note, created_by)
  values (v_claim.business_id, v_card.id, v_customer.id, v_visit, v_claim.stamps, v_card.stamp_balance,
          'purchase', 'QR de sello', v_claim.created_by);

  update public.stamp_claims
     set status = 'claimed', claimed_at = now(), customer_id = v_customer.id, visit_id = v_visit
   where id = v_claim.id;

  v_new := private.sync_card_rewards(v_card.id);

  perform private.audit(v_claim.business_id, 'stamp_claim.claimed', 'stamp_claim', v_claim.id,
    jsonb_build_object('customer_id', v_customer.id, 'stamps', v_claim.stamps, 'issued_by', v_claim.created_by));

  return jsonb_build_object('slug', v_slug, 'stamps', v_claim.stamps, 'stamp_balance', v_card.stamp_balance,
                            'new_rewards', v_new, 'duplicate', false);
end $$;

revoke execute on function public.create_stamp_claim(uuid, integer, numeric, integer),
  public.get_stamp_claim_status(uuid, uuid), public.cancel_stamp_claim(uuid, uuid),
  public.get_stamp_claim_public(text), public.claim_stamps(text) from public, anon, authenticated;
grant execute on function public.create_stamp_claim(uuid, integer, numeric, integer),
  public.get_stamp_claim_status(uuid, uuid), public.cancel_stamp_claim(uuid, uuid),
  public.claim_stamps(text) to authenticated;
grant execute on function public.get_stamp_claim_public(text) to anon, authenticated;
grant execute on all functions in schema public to service_role;
