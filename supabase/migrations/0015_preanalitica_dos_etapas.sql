-- ============================================================
-- 0015 — Preanalítica en dos etapas (Control 1 / Control 2)
-- ============================================================
-- El control preanalítico se hace en dos pasos sucesivos. Para poder
-- registrar quién hizo cada uno (un nombre de una lista fija, no un usuario
-- del sistema) y la observación propia del Control 2, agregamos:
--   responsable_1 / responsable_2 → nombre de quien marcó cada control.
--   detalle_2                     → observación cargada en el Control 2
--                                   (la del Control 1 sigue en `detalle`).
-- Las etapas se derivan de control_1/control_2/estado, sin estados nuevos:
--   Control 1  → estado='pendiente' y control_1 distinto de 'ok'
--   Control 2  → estado='pendiente' y control_1='ok' y control_2 sin 'ok'
--   Controlado → estado='ok'
--   Observado  → estado in ('observado','rechazado')

alter table control_preanalitica
  add column if not exists responsable_1 text,
  add column if not exists responsable_2 text,
  add column if not exists detalle_2 text;
