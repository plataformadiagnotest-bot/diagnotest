-- Agrega el método de pago a los retiros
-- Ejecutar en el SQL Editor de Supabase.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'metodo_pago') then
    create type metodo_pago as enum ('efectivo', 'transferencia', 'mercado_pago');
  end if;
end$$;

alter table retiros
  add column if not exists metodo_pago metodo_pago not null default 'efectivo';
