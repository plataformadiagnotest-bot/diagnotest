-- ── Adjuntar fotos en preanalítica ─────────────────────────
-- Cada control puede tener varias fotos (URLs públicas del bucket "comprobantes").
alter table control_preanalitica
  add column if not exists fotos_urls text[] not null default '{}';
