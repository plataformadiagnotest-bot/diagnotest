-- ============================================================
-- 0020 — Retiros con importe $0 no entran a cobranzas
-- ============================================================
-- Misma lógica que "0 muestras → no entra a preanalítica" (0016), pero para
-- cobranzas: si el retiro no declara importe ($0), no hay nada que cobrar, así
-- que no se crea el control de cobranzas (no aparece en la bandeja de
-- cobranzas). El retiro queda igual en el registro de logística.

create or replace function create_controls_on_retiro()
returns trigger language plpgsql security definer as $$
declare
  resp_c1 text;
begin
  -- Preanalítica: solo si hay muestras. Hereda el responsable activo de Control 1.
  if coalesce(new.cantidad_muestras, 0) > 0 then
    select responsable into resp_c1
      from preanalitica_responsable_activo where stage = 'c1';

    insert into control_preanalitica (retiro_id, urgente, responsable_1)
    values (new.id, new.urgente, resp_c1)
    on conflict (retiro_id) do nothing;
  end if;

  -- Cobranzas: solo si hay importe declarado (> $0).
  if coalesce(new.importe_declarado, 0) > 0 then
    insert into control_cobranzas (retiro_id, importe_declarado)
    values (new.id, new.importe_declarado)
    on conflict (retiro_id) do nothing;
  end if;

  return new;
end;
$$;

-- Limpieza de los controles de cobranzas ya generados para retiros de $0:
-- solo se borran los que siguen pendientes y sin ningún dato cargado (no se
-- toca nada que cobranzas haya empezado a trabajar).
delete from control_cobranzas cc
using retiros r
where cc.retiro_id = r.id
  and coalesce(r.importe_declarado, 0) = 0
  and cc.estado = 'pendiente'
  and cc.importe_validado is null
  and cc.diferencia is null
  and cc.detalle is null
  and cc.medio_pago is null
  and cc.responsable_id is null;
