-- ── CONTROL DE CAJA (Rendición por cadete por día) ─────────────
-- Control 1 (Validación de Recaudación) realizado por Dirección.
-- Grano: un registro por (cadete, fecha_operativa).
-- Guarda un snapshot de los montos al momento de validar para trazabilidad.

create table if not exists rendiciones_caja (
  id                  uuid primary key default uuid_generate_v4(),
  personal_id         uuid not null references personal(id),
  fecha_operativa     date not null,
  total_efectivo      numeric(12,2) not null default 0,  -- recaudado en efectivo
  total_digital       numeric(12,2) not null default 0,  -- transferencia + mercado pago (info)
  total_recaudado     numeric(12,2) not null default 0,  -- efectivo + digital
  total_gastos        numeric(12,2) not null default 0,  -- gasto + retiro de dinero
  efectivo_esperado   numeric(12,2) not null default 0,  -- total_efectivo - total_gastos
  importe_validado    numeric(12,2),                     -- efectivo contado por Dirección
  diferencia          numeric(12,2) not null default 0,  -- importe_validado - efectivo_esperado
  estado              text not null default 'pendiente', -- 'validado' | 'diferencia'
  observacion         text,
  responsable_id      uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (personal_id, fecha_operativa)
);

create index if not exists idx_rendiciones_caja_fecha on rendiciones_caja(fecha_operativa);
create index if not exists idx_rendiciones_caja_personal on rendiciones_caja(personal_id);

-- RLS habilitado sin políticas: solo el service role (API guardada a Dirección) accede.
alter table rendiciones_caja enable row level security;
