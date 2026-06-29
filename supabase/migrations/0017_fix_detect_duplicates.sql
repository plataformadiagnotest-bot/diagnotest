-- ============================================================
-- 0017 — Corrección del detector de duplicados
-- ============================================================
-- Problema detectado: duplicados perfectos (mismo cadete, vete, fecha,
-- muestras e importe, incluso con idéntico timestamp_carga) NO se marcaban
-- como duplicado_sospechoso.
--
-- Causa raíz: la condición de ventana temporal comparaba contra now()
--   and timestamp_carga > (now() - interval '30 minutes')
-- Es decir, contra el momento del INSERT en el servidor, no contra la
-- captura del otro retiro. Cuando el cadete carga OFFLINE y sincroniza más
-- tarde (now() >> timestamp_carga), la condición daba falso y ningún
-- duplicado se detectaba. También fallaba si la copia se recargaba horas
-- después en el día.
--
-- Causa secundaria: el match exigía veterinaria_id = new.veterinaria_id con
-- veterinaria_id NO nulo. Si el cadete cargaba por NOMBRE y no se resolvía el
-- id del padrón, veterinaria_id quedaba nulo y nunca podía marcarse duplicado.
--
-- Corrección:
--   • Se elimina la ventana contra now(): fecha_operativa ya acota al día.
--   • El match de veterinaria admite id del padrón, o código suelto, o nombre
--     normalizado (para los cargados por nombre sin id).
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
  from retiros r
  where r.personal_id = new.personal_id
    and r.fecha_operativa = new.fecha_operativa
    and r.cantidad_muestras = new.cantidad_muestras
    and abs(coalesce(r.importe_declarado, 0) - coalesce(new.importe_declarado, 0)) < 1
    and r.anulado = false
    and r.segunda_visita = false
    and r.id != new.id
    and (
      -- misma veterinaria del padrón
      (new.veterinaria_id is not null and r.veterinaria_id = new.veterinaria_id)
      -- o mismo código suelto (cargado por nombre, sin id resuelto)
      or (new.codigo_original is not null and r.codigo_original is not null
          and lower(btrim(r.codigo_original)) = lower(btrim(new.codigo_original)))
      -- o mismo nombre de veterinaria normalizado
      or (coalesce(btrim(new.veterinaria_texto_original), '') <> ''
          and lower(btrim(coalesce(r.veterinaria_texto_original, '')))
            = lower(btrim(coalesce(new.veterinaria_texto_original, ''))))
    );

  if dup_count > 0 then
    update retiros set estado = 'duplicado_sospechoso' where id = new.id;
  end if;

  return new;
end;
$$;
