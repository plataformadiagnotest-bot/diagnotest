-- ============================================================
-- 0016 — Retiros con 0 muestras no entran a preanalítica
-- ============================================================
-- Si un retiro no trae muestras, no hay nada que controlar: no se crea el
-- control de preanalítica (no aparece en la bandeja ni en Controlados).
-- El retiro queda igual en el registro de logística, y cobranzas se crea
-- normalmente por si hubiera un importe.

create or replace function create_controls_on_retiro()
returns trigger language plpgsql security definer as $$
begin
  -- Solo se controla en preanalítica si hay muestras.
  if coalesce(new.cantidad_muestras, 0) > 0 then
    insert into control_preanalitica (retiro_id, urgente)
    values (new.id, new.urgente)
    on conflict (retiro_id) do nothing;
  end if;

  insert into control_cobranzas (retiro_id, importe_declarado)
  values (new.id, new.importe_declarado)
  on conflict (retiro_id) do nothing;

  return new;
end;
$$;

-- Limpieza de los controles vacíos ya generados para retiros de 0 muestras:
-- solo se borran los que siguen pendientes y sin ningún dato de control
-- cargado (no se toca nada que alguien haya empezado a controlar).
delete from control_preanalitica cp
using retiros r
where cp.retiro_id = r.id
  and coalesce(r.cantidad_muestras, 0) = 0
  and cp.estado = 'pendiente'
  and cp.control_1 is null
  and cp.control_2 is null
  and coalesce(array_length(cp.etiquetas, 1), 0) = 0;
