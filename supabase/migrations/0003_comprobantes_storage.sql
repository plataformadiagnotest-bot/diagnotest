-- Foto de comprobante/ticket en retiros + bucket de Storage.
-- Ejecutar en el SQL Editor de Supabase.

-- 1) Columna para la foto del comprobante en retiros
alter table retiros add column if not exists comprobante_url text;

-- 2) Bucket público para comprobantes/tickets
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do nothing;

-- 3) Políticas de acceso al bucket
drop policy if exists "comprobantes_public_read" on storage.objects;
create policy "comprobantes_public_read"
  on storage.objects for select
  using (bucket_id = 'comprobantes');

drop policy if exists "comprobantes_auth_insert" on storage.objects;
create policy "comprobantes_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes');

drop policy if exists "comprobantes_auth_update" on storage.objects;
create policy "comprobantes_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'comprobantes');
