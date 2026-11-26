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
