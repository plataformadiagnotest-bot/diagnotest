-- ============================================================
-- 0011 — Nuevo rol de usuario "carga" (solo lectura de controlados)
-- ============================================================
-- Ejecutar PRIMERO y por separado: agregar un valor a un enum debe
-- estar confirmado antes de poder usarse en políticas (migración 0012).
alter type user_role add value if not exists 'carga';
