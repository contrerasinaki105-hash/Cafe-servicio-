-- Supabase Auth crea el usuario y escribe app_metadata en un UPDATE
-- posterior. Sincronizamos el perfil también cuando cambia app_metadata
-- (solo el servidor con service_role puede modificarlo).
create or replace function private.sync_profile_from_auth()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_kind text := coalesce(new.raw_app_meta_data ->> 'kind', 'staff');
begin
  if v_kind not in ('staff', 'customer') then v_kind := 'staff'; end if;
  update public.profiles p
     set kind = v_kind,
         phone = case when v_kind = 'customer' then new.raw_app_meta_data ->> 'phone' else null end,
         email = case when v_kind = 'staff' then new.email else null end,
         full_name = coalesce(p.full_name, private.clean_text(new.raw_app_meta_data ->> 'full_name'))
   where p.id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_app_metadata on auth.users;
create trigger on_auth_user_app_metadata
  after update of raw_app_meta_data, email on auth.users
  for each row
  when (old.raw_app_meta_data is distinct from new.raw_app_meta_data or old.email is distinct from new.email)
  execute function private.sync_profile_from_auth();

revoke all on function private.sync_profile_from_auth() from public, anon, authenticated;

-- Corrige perfiles creados antes de esta migración.
update public.profiles p
   set kind = case when u.raw_app_meta_data ->> 'kind' = 'customer' then 'customer' else 'staff' end,
       phone = case when u.raw_app_meta_data ->> 'kind' = 'customer' then u.raw_app_meta_data ->> 'phone' else null end,
       email = case when u.raw_app_meta_data ->> 'kind' = 'customer' then null else u.email end,
       full_name = coalesce(p.full_name, private.clean_text(u.raw_app_meta_data ->> 'full_name'))
  from auth.users u
 where u.id = p.id;
