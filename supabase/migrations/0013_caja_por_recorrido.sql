-- ── CAJA POR RECORRIDO (corte por validación, no por día) ──────────
-- Antes: una rendición por (cadete, día). Ahora la "caja abierta" de un
-- cadete junta TODOS sus retiros y gastos no validados (sin importar el día).
-- Al validar, se cierra: se crea una rendición y se sellan esos registros
-- con su id; la próxima caja arranca de cero. Pueden coexistir varias cajas
-- por cadete en un mismo día (vuelta de la mañana / de la tarde).

-- 1) Permitir varias rendiciones por cadete por día (sacar el unique viejo).
alter table rendiciones_caja
  drop constraint if exists rendiciones_caja_personal_id_fecha_operativa_key;

-- 2) Sellar cada retiro/gasto con la rendición (caja) que lo cerró.
--    rendicion_id NULL = pertenece a la caja abierta (todavía sin validar).
alter table retiros
  add column if not exists rendicion_id uuid references rendiciones_caja(id) on delete set null;
alter table gastos
  add column if not exists rendicion_id uuid references rendiciones_caja(id) on delete set null;

create index if not exists idx_retiros_rendicion on retiros(rendicion_id);
create index if not exists idx_gastos_rendicion on gastos(rendicion_id);
-- Acelera el cálculo de la caja abierta por cadete (registros sin validar).
create index if not exists idx_retiros_caja_abierta on retiros(personal_id) where rendicion_id is null;
create index if not exists idx_gastos_caja_abierta on gastos(personal_id) where rendicion_id is null;
