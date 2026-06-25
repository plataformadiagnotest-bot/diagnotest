-- ============================================================
-- 0014 — Segunda visita (retiro de la misma veterinaria en el día)
-- ============================================================
-- Cuando el cadete carga un retiro de una veterinaria que ya registró hoy
-- y confirma que NO es un duplicado sino una segunda visita real, marcamos
-- el retiro con esta bandera. Eso cumple dos funciones:
--   1) Lo saca del circuito de "duplicados sospechosos" (el cadete ya validó
--      que es una visita legítima; no hace falta revisarlo de nuevo).
--   2) Permite mostrar una etiqueta visible en la bandeja de preanalítica.

alter table retiros
  add column if not exists segunda_visita boolean not null default false;

-- El detector de duplicados ignora los retiros marcados como segunda visita:
-- el cadete ya confirmó que es una visita distinta, aunque coincidan
-- veterinaria, fecha, muestras e importe.
create or replace function detect_duplicates()
returns trigger language plpgsql security definer as $$
declare
  dup_count integer;
begin
  -- Una segunda visita confirmada por el cadete nunca es duplicado.
  if new.segunda_visita then
    return new;
  end if;

  select count(*) into dup_count
  from retiros
  where personal_id = new.personal_id
    and veterinaria_id = new.veterinaria_id
    and veterinaria_id is not null
    and fecha_operativa = new.fecha_operativa
    and cantidad_muestras = new.cantidad_muestras
    and abs(importe_declarado - new.importe_declarado) < 1
    and timestamp_carga > (now() - interval '30 minutes')
    and anulado = false
    and segunda_visita = false
    and id != new.id;

  if dup_count > 0 then
    update retiros set estado = 'duplicado_sospechoso' where id = new.id;
  end if;

  return new;
end;
$$;
