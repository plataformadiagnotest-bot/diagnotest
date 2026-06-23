-- ============================================================
-- 0012 — Cancelar / comentarios en preanalítica + RLS carga/cobranzas
-- ============================================================
-- Ejecutar DESPUÉS de 0011 (el rol 'carga' ya debe existir).

-- (1) Campos de cancelación y comentario libre en el control preanalítico
alter table control_preanalitica
  add column if not exists cancelado       boolean not null default false,
  add column if not exists cancelado_motivo text,
  add column if not exists cancelado_por    uuid references profiles(id) on delete set null,
  add column if not exists cancelado_at     timestamptz,
  add column if not exists comentario       text;

-- (2) Cobranzas necesita leer el control preanalítico para mostrar en rojo
--     los cancelados/anulados y el comentario.
drop policy if exists "Cob read pre" on control_preanalitica;
create policy "Cob read pre" on control_preanalitica for select
  using (get_my_role() = 'cobranzas');

-- (3) El rol carga lee controlados y datos relacionados (solo lectura).
drop policy if exists "Carga read pre" on control_preanalitica;
create policy "Carga read pre" on control_preanalitica for select
  using (get_my_role() = 'carga');

drop policy if exists "Carga read retiros" on retiros;
create policy "Carga read retiros" on retiros for select
  using (get_my_role() = 'carga');

drop policy if exists "Carga read vets" on veterinarias;
create policy "Carga read vets" on veterinarias for select
  using (get_my_role() = 'carga');

drop policy if exists "Carga read personal" on personal;
create policy "Carga read personal" on personal for select
  using (get_my_role() = 'carga');
