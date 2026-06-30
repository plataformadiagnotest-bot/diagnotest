-- ============================================================
-- 0019 — Bolsas recibidas por cadete (carga manual de preanalítica)
-- ============================================================
-- Preanalítica anota a mano cuántas bolsas le entrega cada cadete cuando llega
-- al laboratorio, para controlar cuántas se abrieron. Son dos valores por día
-- porque un cadete puede hacer dos recorridos (V1 y V2). El conteo de muestras
-- sigue siendo automático (suma de retiros); esto es un dato aparte y editable.

create table if not exists bolsas_recibidas (
  id uuid primary key default uuid_generate_v4(),
  personal_id uuid not null references personal(id) on delete cascade,
  fecha date not null,
  bolsas_v1 integer,
  bolsas_v2 integer,
  updated_at timestamptz not null default now(),
  unique (personal_id, fecha)
);

create index if not exists idx_bolsas_recibidas_fecha on bolsas_recibidas(fecha);
