-- ============================================================
-- 0022 — Veterinarias fijas (pedido de retiro automático diario)
-- ============================================================
-- Una veterinaria marcada como "fija" genera automáticamente, todos los días,
-- un pedido de retiro. El cadete NO se asigna directo: se infiere por la zona
-- (vet.zona_id → cadete cuyo personal.zona_base_id coincide). Solo genera si la
-- zona tiene EXACTAMENTE un cadete activo; si hay 0 o 2+, no genera y la vet
-- queda listada como "sin resolver" (vista veterinarias_fijas_estado).

-- 1) Marca de veterinaria fija.
alter table veterinarias
  add column if not exists es_fija boolean not null default false;

-- 2) Pedidos: marca de automático y creador opcional (los automáticos no tienen
--    un humano que los cargó).
alter table pedidos_retiro
  add column if not exists es_automatico boolean not null default false;
alter table pedidos_retiro
  alter column creado_por_id drop not null;

-- 3) Generación diaria de pedidos para las veterinarias fijas.
create or replace function generar_pedidos_fijos(p_fecha date default null)
returns integer language plpgsql security definer as $$
declare
  v_tz    text := 'America/Argentina/Buenos_Aires';
  v_fecha date := coalesce(p_fecha, (now() at time zone v_tz)::date);
  v_ini   timestamptz := timezone(v_tz, v_fecha::timestamp);              -- 00:00 BA
  v_fin   timestamptz := timezone(v_tz, (v_fecha + 1)::timestamp);        -- 00:00 BA del día siguiente
  v_limite timestamptz := timezone(v_tz, (v_fecha + 1)::timestamp) - interval '1 minute'; -- 23:59 BA
  v_creados integer := 0;
  v_vet record;
  v_cadete uuid;
  v_cant integer;
begin
  for v_vet in
    select id, zona_id from veterinarias
    where es_fija = true and activa = true and zona_id is not null
  loop
    -- Cadetes activos en la zona de la vet. Solo se genera si hay exactamente 1.
    select count(*), min(p.id) into v_cant, v_cadete
    from personal p
    where p.activo = true and p.zona_base_id = v_vet.zona_id;

    if v_cant <> 1 then
      continue;
    end if;

    -- Idempotencia: no duplicar si esta vet ya tiene un pedido creado hoy
    -- (automático o manual), para que correr el job dos veces no cree copias.
    if exists (
      select 1 from pedidos_retiro
      where veterinaria_id = v_vet.id
        and created_at >= v_ini and created_at < v_fin
    ) then
      continue;
    end if;

    insert into pedidos_retiro
      (veterinaria_id, personal_asignado_id, creado_por_id, estado, urgente, es_automatico, fecha_limite)
    values
      (v_vet.id, v_cadete, null, 'asignado', false, true, v_limite);
    v_creados := v_creados + 1;
  end loop;

  return v_creados;
end;
$$;

-- 4) Estado de resolución de cada vet fija (para la alerta de "sin resolver").
create or replace view veterinarias_fijas_estado as
select
  v.id, v.codigo, v.nombre, v.zona_id, z.nombre as zona_nombre,
  (select count(*) from personal p where p.activo and p.zona_base_id = v.zona_id) as cadetes_en_zona,
  case
    when v.zona_id is null then 'sin_zona'
    when (select count(*) from personal p where p.activo and p.zona_base_id = v.zona_id) = 0 then 'sin_cadete'
    when (select count(*) from personal p where p.activo and p.zona_base_id = v.zona_id) > 1 then 'varios_cadetes'
    else 'ok'
  end as motivo
from veterinarias v
left join zonas z on z.id = v.zona_id
where v.es_fija = true and v.activa = true;

grant select on veterinarias_fijas_estado to authenticated;

-- 5) Agenda diaria a las 00:00 de Buenos Aires (= 03:00 UTC). Requiere la
--    extensión pg_cron habilitada (Supabase → Database → Extensions).
--    Descomentar y correr una vez habilitado pg_cron:
--
-- select cron.schedule('pedidos-fijos-diarios', '0 3 * * *', $$select generar_pedidos_fijos();$$);
