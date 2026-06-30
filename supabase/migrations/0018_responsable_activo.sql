-- ============================================================
-- 0018 — Responsable activo de preanalítica (se replica en los nuevos)
-- ============================================================
-- Guarda el "responsable activo" por etapa (Control 1 / Control 2). Cuando
-- preanalítica aplica el responsable a la bandeja, ese valor queda persistido
-- acá; los retiros nuevos que entran a la bandeja heredan automáticamente el
-- responsable activo de Control 1 (los pendientes nacen siempre en Control 1).

create table if not exists preanalitica_responsable_activo (
  stage text primary key check (stage in ('c1', 'c2')),
  responsable text,
  updated_at timestamptz not null default now()
);

-- Al crear el control de preanalítica de un retiro nuevo, se precarga
-- responsable_1 con el responsable activo de Control 1 (si hay).
create or replace function create_controls_on_retiro()
returns trigger language plpgsql security definer as $$
declare
  resp_c1 text;
begin
  -- Solo se controla en preanalítica si hay muestras.
  if coalesce(new.cantidad_muestras, 0) > 0 then
    select responsable into resp_c1
      from preanalitica_responsable_activo where stage = 'c1';

    insert into control_preanalitica (retiro_id, urgente, responsable_1)
    values (new.id, new.urgente, resp_c1)
    on conflict (retiro_id) do nothing;
  end if;

  insert into control_cobranzas (retiro_id, importe_declarado)
  values (new.id, new.importe_declarado)
  on conflict (retiro_id) do nothing;

  return new;
end;
$$;
