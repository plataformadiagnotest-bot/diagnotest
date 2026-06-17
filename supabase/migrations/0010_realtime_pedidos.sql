-- Habilita Supabase Realtime para pedidos_retiro, así el perfil del cadete
-- se actualiza solo (y vibra/suena) cuando el jefe le asigna un pedido.
-- Ejecutar en el SQL Editor de Supabase.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos_retiro'
  ) then
    alter publication supabase_realtime add table pedidos_retiro;
  end if;
end$$;
