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
