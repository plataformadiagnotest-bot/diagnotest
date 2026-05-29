-- Habilita Supabase Realtime para el panel de autorización.
-- Ejecutar en el SQL Editor de Supabase.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gastos'
  ) then
    alter publication supabase_realtime add table gastos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'retiros'
  ) then
    alter publication supabase_realtime add table retiros;
  end if;
end$$;
